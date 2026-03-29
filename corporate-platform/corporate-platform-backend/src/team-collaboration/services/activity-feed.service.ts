import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../cache/cache.service';
import { RedisService } from '../../cache/redis.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { ActivityQueryDto } from '../dto/activity-query.dto';
import { PaginatedTeamActivity, TeamActivityItem } from '../interfaces/team-activity.interface';

@Injectable()
export class ActivityFeedService {
  private readonly logger = new Logger(ActivityFeedService.name);
  private readonly retentionDays =
    Number(process.env.TEAM_ACTIVITY_RETENTION_DAYS || '90') || 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
  ) {}

  async recordActivity(input: {
    companyId: string;
    userId: string;
    activityType: string;
    metadata?: Record<string, unknown>;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp?: Date;
  }): Promise<TeamActivityItem> {
    const created = await this.prisma.teamActivity.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        activityType: input.activityType,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        ...(input.timestamp && { timestamp: input.timestamp }),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.cache.evict({
      patterns: [
        `team:activity:recent:${input.companyId}:*`,
        `team:activity:summary:${input.companyId}:*`,
      ],
    });

    await this.publishToCompany(input.companyId, {
      type: 'team_activity',
      payload: created,
    });

    return created as unknown as TeamActivityItem;
  }

  async getActivityFeed(
    companyId: string,
    query: ActivityQueryDto,
  ): Promise<PaginatedTeamActivity> {
    const limit = query.limit ?? 25;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const items = await this.prisma.teamActivity.findMany({
      where: {
        companyId,
        ...(query.userId && { userId: query.userId }),
        ...(query.activityType && { activityType: query.activityType }),
        ...(query.entityType && { entityType: query.entityType }),
        ...(query.entityId && { entityId: query.entityId }),
        ...(from || to
          ? {
              timestamp: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id : undefined;

    return {
      items: pageItems as unknown as TeamActivityItem[],
      nextCursor,
    };
  }

  async getRecentActivities(companyId: string, limit = 10) {
    const key = `team:activity:recent:${companyId}:${limit}`;
    const cached = await this.cache.get<TeamActivityItem[]>(key);
    if (cached) {
      return cached;
    }

    const items = await this.prisma.teamActivity.findMany({
      where: { companyId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: limit,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const normalized = items as unknown as TeamActivityItem[];
    await this.cache.set(key, normalized, 10);
    return normalized;
  }

  async getActivitySummary(companyId: string, range?: { from?: Date; to?: Date }) {
    const from = range?.from;
    const to = range?.to;
    const key = `team:activity:summary:${companyId}:${from?.toISOString() || 'na'}:${to?.toISOString() || 'na'}`;
    const cached = await this.cache.get<{ activityType: string; count: number }[]>(key);
    if (cached) {
      return cached;
    }

    const rows = await this.prisma.teamActivity.groupBy({
      by: ['activityType'],
      where: {
        companyId,
        ...(from || to
          ? {
              timestamp: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
    });

    const summary = rows.map((r) => ({
      activityType: r.activityType,
      count: r._count._all,
    }));

    await this.cache.set(key, summary, 60);
    return summary;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async enforceRetention(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    try {
      const result = await this.prisma.teamActivity.deleteMany({
        where: { timestamp: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`Deleted ${result.count} team activities older than ${cutoff.toISOString()}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(message);
    }
  }

  private async publishToCompany(companyId: string, message: Record<string, unknown>) {
    try {
      const client: any = this.redis.getClient();
      if (!client || !this.redis.isHealthy()) {
        return;
      }
      await client.publish(`team-activity:${companyId}`, JSON.stringify(message));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(message);
    }
  }
}

