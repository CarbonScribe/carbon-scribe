import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  TeamPerformance,
  PerformanceQuery,
  PerformanceMetrics,
  MemberPerformance,
  PerformanceTrends,
  PerformanceBenchmarks,
  TrendData,
} from '../interfaces/team-performance.interface';

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTeamPerformance(query: PerformanceQuery): Promise<TeamPerformance> {
    const {
      companyId,
      periodStart,
      periodEnd,
      includeMembers = true,
      includeTrends = true,
      includeBenchmarks = true,
    } = query;

    const metrics = await this.calculateMetrics(
      companyId,
      periodStart,
      periodEnd,
    );
    const memberMetrics = includeMembers
      ? await this.getMemberMetrics(companyId, periodStart, periodEnd)
      : [];
    const trends = includeTrends
      ? await this.calculateTrends(companyId, periodStart, periodEnd)
      : { actionsTrend: [], engagementTrend: [], completionTrend: [] };
    const benchmarks = includeBenchmarks
      ? this.calculateBenchmarks(metrics, memberMetrics)
      : {
          industryAverage: 65,
          teamAverage: metrics.engagementScore,
          topPerformerThreshold: 80,
          needsImprovementThreshold: 40,
        };

    return {
      companyId,
      periodStart,
      periodEnd,
      metrics,
      memberMetrics,
      trends,
      benchmarks,
    };
  }

  async getMemberPerformance(
    companyId: string,
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MemberPerformance | null> {
    const activities = await (this.prisma as any).teamActivity.findMany({
      where: {
        companyId,
        userId,
        timestamp: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    if (!activities || activities.length === 0) {
      return null;
    }

    // Get user details
    const user = await (this.prisma as any).user.findFirst({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const uniqueDays = new Set(
      activities.map((a: any) => new Date(a.timestamp).toDateString()),
    ).size;

    const activityTypeCount: Record<string, number> = {};
    activities.forEach((a: any) => {
      activityTypeCount[a.activityType] =
        (activityTypeCount[a.activityType] || 0) + 1;
    });

    const topActivityType =
      Object.entries(activityTypeCount).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'UNKNOWN';

    return {
      userId,
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      actionsCount: activities.length,
      uniqueDays,
      completionRate: this.calculateCompletionRate(activities),
      avgResponseTime: 0, // Would need interaction data
      topActivityType,
      rank: 0, // Would need comparative calculation
    };
  }

  private async calculateMetrics(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceMetrics> {
    const activities = await (this.prisma as any).teamActivity.findMany({
      where: {
        companyId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const uniqueMembers = new Set(activities.map((a: any) => a.userId)).size;
    const uniqueDays = new Set(
      activities.map((a: any) => new Date(a.timestamp).toDateString()),
    ).size;

    const totalActions = activities.length;
    const actionsPerMember =
      uniqueMembers > 0 ? totalActions / uniqueMembers : 0;

    return {
      totalActions,
      actionsPerMember: Math.round(actionsPerMember * 100) / 100,
      activeDays: uniqueDays,
      completionRate: this.calculateCompletionRate(activities),
      avgResponseTime: 0, // Would need mention/response tracking
      goalProgress: await this.calculateGoalProgress(
        companyId,
        startDate,
        endDate,
      ),
      engagementScore: this.calculateEngagementScore(
        activities,
        uniqueMembers,
        uniqueDays,
      ),
    };
  }

  private async getMemberMetrics(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MemberPerformance[]> {
    const members = await (this.prisma as any).teamMember.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { user: true },
    });

    const memberMetrics: MemberPerformance[] = [];

    for (const member of members) {
      const metrics = await this.getMemberPerformance(
        companyId,
        member.userId,
        startDate,
        endDate,
      );
      if (metrics) {
        memberMetrics.push(metrics);
      }
    }

    // Sort by actionsCount and assign ranks
    memberMetrics.sort((a, b) => b.actionsCount - a.actionsCount);
    memberMetrics.forEach((m, index) => {
      m.rank = index + 1;
    });

    return memberMetrics;
  }

  private async calculateTrends(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceTrends> {
    // Group activities by week
    const weeks = this.getWeeksBetween(startDate, endDate);

    const actionsTrend: TrendData[] = [];
    const engagementTrend: TrendData[] = [];
    const completionTrend: TrendData[] = [];

    for (const week of weeks) {
      const weekStart = week.start;
      const weekEnd = week.end;

      const activities = await (this.prisma as any).teamActivity.findMany({
        where: {
          companyId,
          timestamp: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });

      const uniqueMembers = new Set(activities.map((a: any) => a.userId)).size;

      actionsTrend.push({
        period: `Week of ${weekStart.toLocaleDateString()}`,
        value: activities.length,
        date: weekStart,
      });

      engagementTrend.push({
        period: `Week of ${weekStart.toLocaleDateString()}`,
        value: this.calculateEngagementScore(activities, uniqueMembers, 7),
        date: weekStart,
      });

      completionTrend.push({
        period: `Week of ${weekStart.toLocaleDateString()}`,
        value: this.calculateCompletionRate(activities),
        date: weekStart,
      });
    }

    return { actionsTrend, engagementTrend, completionTrend };
  }

  private calculateBenchmarks(
    metrics: PerformanceMetrics,
    memberMetrics: MemberPerformance[],
  ): PerformanceBenchmarks {
    const scores = memberMetrics.map((m) => m.actionsCount);
    const avgScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      industryAverage: 65, // Would come from industry data
      teamAverage: Math.round(avgScore * 100) / 100,
      topPerformerThreshold: 80,
      needsImprovementThreshold: 40,
    };
  }

  private calculateEngagementScore(
    activities: any[],
    uniqueMembers: number,
    uniqueDays: number,
  ): number {
    // Simple scoring algorithm
    const activityScore = Math.min(activities.length / 10, 40); // Max 40 points
    const consistencyScore = Math.min(uniqueDays / 5, 30); // Max 30 points
    const participationScore = Math.min(uniqueMembers * 10, 30); // Max 30 points

    return (
      Math.round(
        (activityScore + consistencyScore + participationScore) * 100,
      ) / 100
    );
  }

  private calculateCompletionRate(activities: any[]): number {
    // Count completion-related activities
    const completionTypes = [
      'COMPLIANCE_COMPLETED',
      'RETIREMENT_CREATED',
      'REPORT_GENERATED',
      'TARGET_SET',
    ];
    const completions = activities.filter((a) =>
      completionTypes.includes(a.activityType),
    ).length;

    return activities.length > 0
      ? Math.round((completions / activities.length) * 100 * 100) / 100
      : 0;
  }

  private async calculateGoalProgress(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // Check retirement targets vs actual
    const targets = await (this.prisma as any).retirementTarget.findMany({
      where: {
        companyId,
      },
    });

    const retirements = await (this.prisma as any).retirement.count({
      where: {
        companyId,
        retiredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const targetTotal = targets.reduce(
      (sum: number, t: any) => sum + t.target,
      0,
    );

    return targetTotal > 0
      ? Math.round((retirements / targetTotal) * 100 * 100) / 100
      : 0;
  }

  private getWeeksBetween(
    start: Date,
    end: Date,
  ): Array<{ start: Date; end: Date }> {
    const weeks: Array<{ start: Date; end: Date }> = [];
    const current = new Date(start);

    while (current < end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);

      weeks.push({ start: weekStart, end: weekEnd > end ? end : weekEnd });
      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }
}
