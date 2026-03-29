import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../cache/cache.service';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  MemberPerformanceSummary,
  PerformanceTrendPoint,
  TeamPerformanceDashboard,
} from '../interfaces/team-performance.interface';

@Injectable()
export class PerformanceMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getTeamDashboard(companyId: string, range?: { from?: Date; to?: Date }) {
    const { periodStart, periodEnd } = this.normalizeRange(range);
    const key = `team:performance:dashboard:${companyId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
    const cached = await this.cache.get<TeamPerformanceDashboard>(key);
    if (cached) {
      return cached;
    }

    const [totalActions, memberGroups, topTypes] = await Promise.all([
      this.prisma.teamActivity.count({
        where: {
          companyId,
          timestamp: { gte: periodStart, lte: periodEnd },
        },
      }),
      this.prisma.teamActivity.groupBy({
        by: ['userId'],
        where: {
          companyId,
          timestamp: { gte: periodStart, lte: periodEnd },
        },
        _count: { _all: true },
      }),
      this.prisma.teamActivity.groupBy({
        by: ['activityType'],
        where: {
          companyId,
          timestamp: { gte: periodStart, lte: periodEnd },
        },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 10,
      }),
    ]);

    const days = Math.max(
      1,
      Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const dashboard: TeamPerformanceDashboard = {
      periodStart,
      periodEnd,
      totalActions,
      activeMembers: memberGroups.length,
      actionsPerDay: totalActions / days,
      topActivityTypes: topTypes.map((t) => ({
        activityType: t.activityType,
        count: t._count._all,
      })),
    };

    await this.cache.set(key, dashboard, 60);
    return dashboard;
  }

  async getMemberPerformance(
    companyId: string,
    range?: { from?: Date; to?: Date },
  ): Promise<MemberPerformanceSummary[]> {
    const { periodStart, periodEnd } = this.normalizeRange(range);

    const counts = await this.prisma.teamActivity.groupBy({
      by: ['userId'],
      where: {
        companyId,
        timestamp: { gte: periodStart, lte: periodEnd },
      },
      _count: { _all: true },
    });

    const uniqueDaysRows = (await this.prisma.$queryRaw(
      Prisma.sql`
        SELECT "userId"::text AS "userId",
               COUNT(DISTINCT DATE("timestamp"))::int AS "uniqueDays"
        FROM "team_activities"
        WHERE "companyId" = ${companyId}
          AND "timestamp" >= ${periodStart}
          AND "timestamp" <= ${periodEnd}
        GROUP BY "userId"
      `,
    )) as { userId: string; uniqueDays: number }[];

    const contributionsRows = await this.prisma.teamActivity.groupBy({
      by: ['userId', 'activityType'],
      where: {
        companyId,
        timestamp: { gte: periodStart, lte: periodEnd },
      },
      _count: { _all: true },
    });

    const uniqueDaysByUser = new Map(
      uniqueDaysRows.map((r) => [r.userId, r.uniqueDays]),
    );

    const contributionsByUser = new Map<string, Record<string, number>>();
    for (const row of contributionsRows) {
      const current = contributionsByUser.get(row.userId) ?? {};
      current[row.activityType] = row._count._all;
      contributionsByUser.set(row.userId, current);
    }

    const engagementRows = await this.prisma.memberEngagement.findMany({
      where: {
        companyId,
        periodStart,
        periodEnd,
      },
      select: { userId: true, collaborationScore: true },
    });
    const engagementByUser = new Map(
      engagementRows.map((r) => [r.userId, r.collaborationScore]),
    );

    return counts
      .map((c) => {
        const actionsCount = c._count._all;
        const uniqueDays = uniqueDaysByUser.get(c.userId) ?? 0;
        const contributions = contributionsByUser.get(c.userId) ?? {};
        const collaborationScore = engagementByUser.get(c.userId) ?? this.estimateCollaborationScore(contributions);
        return {
          userId: c.userId,
          actionsCount,
          uniqueDays,
          contributions,
          collaborationScore,
        };
      })
      .sort((a, b) => b.actionsCount - a.actionsCount);
  }

  async getTrends(
    companyId: string,
    range?: { from?: Date; to?: Date },
  ): Promise<PerformanceTrendPoint[]> {
    const { periodStart, periodEnd } = this.normalizeRange(range);

    const rows = (await this.prisma.$queryRaw(
      Prisma.sql`
        SELECT date_trunc('day', "timestamp") AS "bucketStart",
               COUNT(*)::int AS "actionsCount",
               COUNT(DISTINCT "userId")::int AS "activeMembers"
        FROM "team_activities"
        WHERE "companyId" = ${companyId}
          AND "timestamp" >= ${periodStart}
          AND "timestamp" <= ${periodEnd}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    )) as { bucketStart: Date; actionsCount: number; activeMembers: number }[];

    return rows;
  }

  async getBenchmarks(companyId: string, range?: { from?: Date; to?: Date }) {
    const members = await this.getMemberPerformance(companyId, range);
    if (!members.length) {
      return {
        averages: { actionsCount: 0, uniqueDays: 0, collaborationScore: 0 },
        members: [],
      };
    }

    const avg = {
      actionsCount: members.reduce((s, m) => s + m.actionsCount, 0) / members.length,
      uniqueDays: members.reduce((s, m) => s + m.uniqueDays, 0) / members.length,
      collaborationScore:
        members.reduce((s, m) => s + m.collaborationScore, 0) / members.length,
    };

    return {
      averages: avg,
      members: members.map((m) => ({
        ...m,
        vsAverage: {
          actionsCount: m.actionsCount - avg.actionsCount,
          uniqueDays: m.uniqueDays - avg.uniqueDays,
          collaborationScore: m.collaborationScore - avg.collaborationScore,
        },
      })),
    };
  }

  private normalizeRange(range?: { from?: Date; to?: Date }) {
    const now = new Date();
    const periodEnd = range?.to ?? now;
    const periodStart =
      range?.from ?? new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { periodStart, periodEnd };
  }

  private estimateCollaborationScore(contributions: Record<string, number>) {
    const total = Object.values(contributions).reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    const collaborationSignals = Object.entries(contributions)
      .filter(([k]) =>
        ['COMMENT', 'MENTION', 'ASSIGN', 'REVIEW', 'DOCUMENT', 'MEETING'].some((p) =>
          k.toUpperCase().includes(p),
        ),
      )
      .reduce((s, [, v]) => s + v, 0);
    return Math.min(100, (collaborationSignals / total) * 120);
  }
}

