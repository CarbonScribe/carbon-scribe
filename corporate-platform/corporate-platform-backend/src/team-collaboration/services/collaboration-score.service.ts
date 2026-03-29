import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../cache/cache.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CollaborationScoreBreakdown } from '../interfaces/collaboration-score.interface';

type MetricType = 'WEEKLY_SCORE' | 'MONTHLY_SCORE';

@Injectable()
export class CollaborationScoreService {
  private readonly weights: Record<string, number> = {
    activityConsistency: 0.25,
    contributionVolume: 0.25,
    knowledgeSharing: 0.2,
    responsiveness: 0.15,
    crossInteraction: 0.15,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getCurrentTeamScore(companyId: string): Promise<CollaborationScoreBreakdown> {
    const { periodStart, periodEnd } = this.currentWeekRangeUtc();
    const key = `team:collaboration:current:${companyId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
    const cached = await this.cache.get<CollaborationScoreBreakdown>(key);
    if (cached) {
      return cached;
    }

    const score = await this.computeTeamScore(companyId, periodStart, periodEnd);
    await this.cache.set(key, score, 60);
    return score;
  }

  async getScoreHistory(companyId: string, metricType?: MetricType, limit = 26) {
    return this.prisma.collaborationMetric.findMany({
      where: {
        companyId,
        ...(metricType && { metricType }),
      },
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
  }

  async getComponents(companyId: string) {
    const current = await this.getCurrentTeamScore(companyId);
    return current.components;
  }

  async getRecommendations(companyId: string) {
    const current = await this.getCurrentTeamScore(companyId);
    const recommendations: string[] = [];
    const components = current.components;

    if ((components.activityConsistency ?? 0) < 60) {
      recommendations.push(
        'Increase participation consistency by spreading actions across more unique days.',
      );
    }
    if ((components.contributionVolume ?? 0) < 60) {
      recommendations.push(
        'Increase overall activity volume by setting weekly contribution targets and nudges.',
      );
    }
    if ((components.knowledgeSharing ?? 0) < 60) {
      recommendations.push(
        'Encourage knowledge sharing through comments, document edits, and report contributions.',
      );
    }
    if ((components.responsiveness ?? 0) < 60) {
      recommendations.push(
        'Improve responsiveness by reducing time-to-acknowledge mentions and assignments.',
      );
    }
    if ((components.crossInteraction ?? 0) < 60) {
      recommendations.push(
        'Increase cross-team interactions by pairing reviewers and rotating responsibilities.',
      );
    }

    if (!recommendations.length) {
      recommendations.push('Maintain current collaboration habits and monitor trends weekly.');
    }

    return recommendations;
  }

  async computeTeamScore(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<CollaborationScoreBreakdown> {
    const memberCounts = await this.prisma.teamActivity.groupBy({
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

    const periodDays = Math.max(
      1,
      Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const perUser = memberCounts.map((m) => {
      const actionsCount = m._count._all;
      const uniqueDays = uniqueDaysByUser.get(m.userId) ?? 0;
      const contributions = contributionsByUser.get(m.userId) ?? {};
      const collaborationScore = this.estimateCollaborationScore(contributions);
      return { userId: m.userId, actionsCount, uniqueDays, contributions, collaborationScore };
    });

    const avgUniqueDays =
      perUser.reduce((s, u) => s + u.uniqueDays, 0) / (perUser.length || 1);
    const avgActions =
      perUser.reduce((s, u) => s + u.actionsCount, 0) / (perUser.length || 1);
    const avgCollab =
      perUser.reduce((s, u) => s + u.collaborationScore, 0) / (perUser.length || 1);

    const activityConsistency = Math.min(100, (avgUniqueDays / periodDays) * 100);
    const targetActionsPerMemberPerDay = 5;
    const contributionVolume = Math.min(
      100,
      (avgActions / (periodDays * targetActionsPerMemberPerDay)) * 100,
    );

    const knowledgeSharing = Math.min(
      100,
      this.estimateKnowledgeSharing(perUser) * 100,
    );

    const responsiveness = 50;
    const crossInteraction = Math.min(100, avgCollab);

    const components = {
      activityConsistency,
      contributionVolume,
      knowledgeSharing,
      responsiveness,
      crossInteraction,
    };

    const overallScore = this.weightedScore(components);
    const topContributors = perUser
      .map((u) => ({
        userId: u.userId,
        score: (u.collaborationScore * 0.6 + Math.min(100, (u.uniqueDays / periodDays) * 100) * 0.4),
        actionsCount: u.actionsCount,
        uniqueDays: u.uniqueDays,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const insights = this.buildInsights({
      periodDays,
      overallScore,
      components,
      topContributors,
      memberCount: perUser.length,
    });

    return {
      overallScore,
      components,
      topContributors,
      insights,
      explanation: {
        weights: this.weights,
        inputs: {
          periodStart,
          periodEnd,
          periodDays,
          memberCount: perUser.length,
          avgActions,
          avgUniqueDays,
          avgCollaborationScore: avgCollab,
          targetActionsPerMemberPerDay,
        },
      },
    };
  }

  async computeAndPersist(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
    metricType: MetricType,
  ) {
    const breakdown = await this.computeTeamScore(companyId, periodStart, periodEnd);

    const memberPerformance = await this.buildMemberEngagementRows(
      companyId,
      periodStart,
      periodEnd,
    );
    for (const row of memberPerformance) {
      await this.prisma.memberEngagement.upsert({
        where: {
          companyId_userId_periodStart_periodEnd: {
            companyId,
            userId: row.userId,
            periodStart,
            periodEnd,
          },
        },
        update: {
          actionsCount: row.actionsCount,
          uniqueDays: row.uniqueDays,
          contributions: row.contributions,
          collaborationScore: row.collaborationScore,
          responseTimeAvg: row.responseTimeAvg,
        },
        create: {
          companyId,
          userId: row.userId,
          periodStart,
          periodEnd,
          actionsCount: row.actionsCount,
          uniqueDays: row.uniqueDays,
          contributions: row.contributions,
          collaborationScore: row.collaborationScore,
          responseTimeAvg: row.responseTimeAvg,
        },
      });
    }

    return this.prisma.collaborationMetric.create({
      data: {
        companyId,
        periodStart,
        periodEnd,
        metricType,
        overallScore: breakdown.overallScore,
        components: breakdown.components,
        topContributors: breakdown.topContributors,
        insights: breakdown.insights,
      },
    });
  }

  @Cron('0 15 0 * * 1')
  async computeWeeklyScores(): Promise<void> {
    const { periodStart, periodEnd } = this.previousWeekRangeUtc();
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    for (const c of companies) {
      await this.computeAndPersist(c.id, periodStart, periodEnd, 'WEEKLY_SCORE');
    }
  }

  @Cron('0 30 0 1 * *')
  async computeMonthlyScores(): Promise<void> {
    const { periodStart, periodEnd } = this.previousMonthRangeUtc();
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    for (const c of companies) {
      await this.computeAndPersist(c.id, periodStart, periodEnd, 'MONTHLY_SCORE');
    }
  }

  private weightedScore(components: Record<string, number>) {
    const entries = Object.entries(this.weights);
    const totalWeight = entries.reduce((s, [, w]) => s + w, 0) || 1;
    const raw = entries.reduce((s, [k, w]) => s + (components[k] ?? 0) * w, 0);
    return Math.max(0, Math.min(100, raw / totalWeight));
  }

  private estimateCollaborationScore(contributions: Record<string, number>) {
    const total = Object.values(contributions).reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    const interaction = Object.entries(contributions)
      .filter(([k]) =>
        ['COMMENT', 'MENTION', 'ASSIGN', 'REVIEW', 'MEETING', 'DISCUSS'].some((p) =>
          k.toUpperCase().includes(p),
        ),
      )
      .reduce((s, [, v]) => s + v, 0);
    return Math.min(100, (interaction / total) * 150);
  }

  private estimateKnowledgeSharing(perUser: { contributions: Record<string, number> }[]) {
    const totals = perUser.map((u) => {
      const total = Object.values(u.contributions).reduce((s, v) => s + v, 0);
      const sharing = Object.entries(u.contributions)
        .filter(([k]) =>
          ['REPORT', 'DOCUMENT', 'COMMENT', 'NOTE', 'WIKI'].some((p) =>
            k.toUpperCase().includes(p),
          ),
        )
        .reduce((s, [, v]) => s + v, 0);
      return { total, sharing };
    });
    const totalAll = totals.reduce((s, t) => s + t.total, 0);
    if (totalAll === 0) return 0;
    const sharingAll = totals.reduce((s, t) => s + t.sharing, 0);
    return Math.min(1, sharingAll / totalAll);
  }

  private buildInsights(input: {
    periodDays: number;
    overallScore: number;
    components: Record<string, number>;
    topContributors: { userId: string; score: number }[];
    memberCount: number;
  }) {
    const insights: string[] = [];
    insights.push(`Collaboration score is ${Math.round(input.overallScore)} / 100 for ${input.memberCount} members.`);

    const ordered = Object.entries(input.components).sort((a, b) => a[1] - b[1]);
    const lowest = ordered[0];
    const highest = ordered[ordered.length - 1];
    if (highest) {
      insights.push(`Strongest factor: ${highest[0]} (${Math.round(highest[1])}).`);
    }
    if (lowest) {
      insights.push(`Most improvable factor: ${lowest[0]} (${Math.round(lowest[1])}).`);
    }
    if (input.topContributors.length) {
      insights.push(`Top contributor: ${input.topContributors[0].userId}.`);
    }
    return insights;
  }

  private currentWeekRangeUtc() {
    const now = new Date();
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (day - 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    end.setUTCMilliseconds(-1);
    return { periodStart: start, periodEnd: end };
  }

  private previousWeekRangeUtc() {
    const current = this.currentWeekRangeUtc();
    const end = new Date(current.periodStart);
    end.setUTCMilliseconds(-1);
    const start = new Date(current.periodStart);
    start.setUTCDate(start.getUTCDate() - 7);
    return { periodStart: start, periodEnd: end };
  }

  private previousMonthRangeUtc() {
    const now = new Date();
    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(startOfThisMonth);
    end.setUTCMilliseconds(-1);
    const start = new Date(Date.UTC(startOfThisMonth.getUTCFullYear(), startOfThisMonth.getUTCMonth() - 1, 1));
    return { periodStart: start, periodEnd: end };
  }

  private async buildMemberEngagementRows(companyId: string, periodStart: Date, periodEnd: Date) {
    const memberCounts = await this.prisma.teamActivity.groupBy({
      by: ['userId'],
      where: { companyId, timestamp: { gte: periodStart, lte: periodEnd } },
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
    const uniqueDaysByUser = new Map(
      uniqueDaysRows.map((r) => [r.userId, r.uniqueDays]),
    );

    const contributionsRows = await this.prisma.teamActivity.groupBy({
      by: ['userId', 'activityType'],
      where: { companyId, timestamp: { gte: periodStart, lte: periodEnd } },
      _count: { _all: true },
    });
    const contributionsByUser = new Map<string, Record<string, number>>();
    for (const row of contributionsRows) {
      const current = contributionsByUser.get(row.userId) ?? {};
      current[row.activityType] = row._count._all;
      contributionsByUser.set(row.userId, current);
    }

    return memberCounts.map((m) => {
      const contributions = contributionsByUser.get(m.userId) ?? {};
      const collaborationScore = this.estimateCollaborationScore(contributions);
      return {
        userId: m.userId,
        actionsCount: m._count._all,
        uniqueDays: uniqueDaysByUser.get(m.userId) ?? 0,
        contributions,
        collaborationScore,
        responseTimeAvg: null as number | null,
      };
    });
  }
}
