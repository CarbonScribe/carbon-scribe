import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ActivityFeedService } from './activity-feed.service';

@Injectable()
export class MemberDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityFeed: ActivityFeedService,
  ) {}

  async getMemberDetails(companyId: string, memberId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: memberId, companyId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        isActive: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    const lastActivity = await this.prisma.teamActivity.findFirst({
      where: { companyId, userId: memberId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      select: { timestamp: true },
    });

    const expertise = await this.prisma.teamActivity.groupBy({
      by: ['activityType'],
      where: {
        companyId,
        userId: memberId,
        timestamp: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 8,
    });

    const heatmap = await this.buildContributionHeatmap(companyId, memberId);

    return {
      ...user,
      lastActiveAt: lastActivity?.timestamp ?? null,
      expertiseAreas: expertise.map((e) => ({
        activityType: e.activityType,
        count: e._count._all,
      })),
      contributionHeatmap: heatmap,
    };
  }

  async getActivityHistory(companyId: string, actorCompanyId: string, memberId: string, query: any) {
    if (companyId !== actorCompanyId) {
      throw new ForbiddenException('Cross-tenant access denied');
    }
    const exists = await this.prisma.user.findFirst({
      where: { id: memberId, companyId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Member not found');
    }
    return this.activityFeed.getActivityFeed(companyId, { ...query, userId: memberId });
  }

  async getContributions(companyId: string, memberId: string, range?: { from?: Date; to?: Date }) {
    const user = await this.prisma.user.findFirst({
      where: { id: memberId, companyId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    const from = range?.from;
    const to = range?.to;
    const rows = await this.prisma.teamActivity.groupBy({
      by: ['activityType'],
      where: {
        companyId,
        userId: memberId,
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

    return rows.map((r) => ({ activityType: r.activityType, count: r._count._all }));
  }

  async getCollaborationPatterns(companyId: string, memberId: string, range?: { from?: Date; to?: Date }) {
    const user = await this.prisma.user.findFirst({
      where: { id: memberId, companyId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    const from = range?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = range?.to ?? new Date();

    const activities = await this.prisma.teamActivity.findMany({
      where: {
        companyId,
        userId: memberId,
        timestamp: { gte: from, lte: to },
      },
      select: { metadata: true },
      take: 5000,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });

    const edges = new Map<string, number>();
    for (const a of activities) {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      const ids = this.extractRelatedUserIds(meta);
      for (const otherId of ids) {
        if (!otherId || otherId === memberId) continue;
        const key = `${memberId}:${otherId}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }

    const nodes = new Set<string>([memberId]);
    for (const k of edges.keys()) {
      const [, toUser] = k.split(':');
      nodes.add(toUser);
    }

    return {
      nodes: Array.from(nodes).map((id) => ({ id })),
      edges: Array.from(edges.entries()).map(([k, weight]) => {
        const [fromUser, toUser] = k.split(':');
        return { from: fromUser, to: toUser, weight };
      }),
      range: { from, to },
    };
  }

  private extractRelatedUserIds(metadata: Record<string, unknown>): string[] {
    const candidates = [
      metadata.mentionedUserId,
      metadata.assignedToUserId,
      metadata.reviewerUserId,
      metadata.collaboratorUserId,
    ];

    const fromArrays = [
      ...(Array.isArray(metadata.mentionedUserIds) ? metadata.mentionedUserIds : []),
      ...(Array.isArray(metadata.assignees) ? metadata.assignees : []),
      ...(Array.isArray(metadata.collaborators) ? metadata.collaborators : []),
    ];

    return [...candidates, ...fromArrays]
      .map((v) => (typeof v === 'string' ? v : undefined))
      .filter((v): v is string => Boolean(v));
  }

  private async buildContributionHeatmap(companyId: string, memberId: string) {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.teamActivity.findMany({
      where: { companyId, userId: memberId, timestamp: { gte: from } },
      select: { timestamp: true },
      take: 5000,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });

    const byDay = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.timestamp);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return Array.from(byDay.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  }
}

