import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import {
  TeamActivity,
  ActivityFeedQuery,
  ActivitySummary,
  ActivityType,
} from '../interfaces/team-activity.interface';

@Injectable()
export class ActivityFeedService implements OnModuleInit {
  private readonly logger = new Logger(ActivityFeedService.name);
  private readonly ACTIVITY_TTL_DAYS = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    // Initialize activity cleanup job
    this.cleanupOldActivities();
  }

  async logActivity(data: {
    companyId: string;
    userId: string;
    activityType: ActivityType;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TeamActivity> {
    const activity = await (this.prisma as any).teamActivity.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        activityType: data.activityType,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });

    // Cache in Redis for real-time access
    await this.cacheActivity(activity);

    // Emit via Redis pub/sub for real-time updates
    await this.emitActivityEvent(activity);

    return activity;
  }

  async getActivityFeed(query: ActivityFeedQuery): Promise<{
    activities: TeamActivity[];
    total: number;
    page: number;
    hasMore: boolean;
  }> {
    const {
      companyId,
      userId,
      activityTypes,
      startDate,
      endDate,
      entityTypes,
      page = 1,
      limit = 20,
    } = query;

    const where: any = { companyId };

    if (userId) {
      where.userId = userId;
    }

    if (activityTypes && activityTypes.length > 0) {
      where.activityType = { in: activityTypes };
    }

    if (entityTypes && entityTypes.length > 0) {
      where.entityType = { in: entityTypes };
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    const [activities, total] = await Promise.all([
      (this.prisma as any).teamActivity.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).teamActivity.count({ where }),
    ]);

    return {
      activities,
      total,
      page,
      hasMore: page * limit < total,
    };
  }

  async getRecentActivities(
    companyId: string,
    limit = 10,
  ): Promise<TeamActivity[]> {
    const cacheKey = `activity:recent:${companyId}:${limit}`;

    // Try cache first
    const cached = await this.redis.getClient().get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const activities = await (this.prisma as any).teamActivity.findMany({
      where: { companyId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Cache for 5 minutes
    await this.redis
      .getClient()
      .setex(cacheKey, 300, JSON.stringify(activities));

    return activities;
  }

  async getUserActivity(
    companyId: string,
    userId: string,
    limit = 50,
  ): Promise<TeamActivity[]> {
    return (this.prisma as any).teamActivity.findMany({
      where: { companyId, userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getActivitySummary(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ActivitySummary[]> {
    const activities = await (this.prisma as any).teamActivity.findMany({
      where: {
        companyId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const summaryMap = new Map<string, number>();

    activities.forEach((activity: TeamActivity) => {
      const count = summaryMap.get(activity.activityType) || 0;
      summaryMap.set(activity.activityType, count + 1);
    });

    const total = activities.length;
    const summaries: ActivitySummary[] = [];

    summaryMap.forEach((count, activityType) => {
      summaries.push({
        activityType: activityType as ActivityType,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        trend: 'stable', // Would need historical comparison
      });
    });

    return summaries.sort((a, b) => b.count - a.count);
  }

  private async cacheActivity(activity: TeamActivity): Promise<void> {
    try {
      const key = `activity:${activity.id}`;
      await this.redis.getClient().setex(key, 86400, JSON.stringify(activity)); // 24 hours

      // Add to user's activity stream
      const userKey = `activity:user:${activity.companyId}:${activity.userId}`;
      await this.redis.getClient().lpush(userKey, JSON.stringify(activity));
      await this.redis.getClient().ltrim(userKey, 0, 99); // Keep last 100
    } catch (error) {
      this.logger.error('Error caching activity:', error);
    }
  }

  private async emitActivityEvent(activity: TeamActivity): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'activity:stream',
        JSON.stringify({
          event: 'activity:created',
          companyId: activity.companyId,
          data: activity,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      this.logger.error('Error emitting activity event:', error);
    }
  }

  private async cleanupOldActivities(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.ACTIVITY_TTL_DAYS);

      const result = await (this.prisma as any).teamActivity.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old activities`);
    } catch (error) {
      this.logger.error('Error cleaning up activities:', error);
    }
  }
}
