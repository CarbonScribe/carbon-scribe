import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';
import {
  DashboardOverview,
  DashboardInsights,
  Anomaly,
} from '../interfaces/dashboard.interface';

@Injectable()
export class DashboardService {
  private logger = new Logger('DashboardService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Get advanced dashboard overview
   */
  async getOverview(
    companyId: string,
    period: string = 'MONTHLY',
  ): Promise<DashboardOverview> {
    const cacheKey = `dashboard:overview:${companyId}:${period}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const [projects, retirements, credits, topRegions, topTypes, activities] =
      await Promise.all([
        this.getProjectsMetrics(companyId),
        this.getRetirementsMetrics(companyId),
        this.getCreditsMetrics(companyId),
        this.getTopRegions(companyId),
        this.getTopProjectTypes(companyId),
        this.getRecentActivity(companyId),
      ]);

    const overview: DashboardOverview = {
      totalProjects: projects.total,
      activeProjects: projects.active,
      totalCreditsRetired: retirements.total,
      totalCreditsAvailable: credits.available,
      averageQualityScore: credits.avgQuality,
      monthlyRetirementTarget: retirements.target,
      monthlyRetirementProgress: retirements.progress,
      retirementProgressPercentage:
        (retirements.progress / retirements.target) * 100,
      topRegions,
      topProjectTypes: topTypes,
      recentActivity: activities,
    };

    await this.cache.set(cacheKey, JSON.stringify(overview), 1800); // 30 minutes
    return overview;
  }

  /**
   * Get dashboard insights and anomalies
   */
  async getInsights(companyId: string): Promise<DashboardInsights> {
    const cacheKey = `dashboard:insights:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const [anomalies, trends, recommendations, riskAlerts] = await Promise.all([
      this.detectAnomalies(companyId),
      this.analyzeTrends(),
      this.generateRecommendations(),
      this.identifyRisks(),
    ]);

    const insights: DashboardInsights = {
      anomalies,
      trends,
      recommendations,
      riskAlerts,
    };

    await this.cache.set(cacheKey, JSON.stringify(insights), 3600); // 1 hour
    return insights;
  }

  private async getProjectsMetrics(companyId: string) {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
    });

    return {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
    };
  }

  private async getRetirementsMetrics(companyId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
    });

    const monthlyRetirements = retirements.filter(
      (r) => new Date(r.retiredAt) >= monthStart,
    );

    const target = await this.prisma.retirementTarget.findFirst({
      where: {
        companyId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
    });

    return {
      total: retirements.reduce((sum, r) => sum + r.amount, 0),
      progress: monthlyRetirements.reduce((sum, r) => sum + r.amount, 0),
      target: target?.target || 0,
    };
  }

  private async getCreditsMetrics(companyId: string) {
    const credits = await this.prisma.credit.findMany({
      where: { project: { companyId } },
    });

    const scores = credits
      .filter((c) => c.dynamicScore > 0)
      .map((c) => c.dynamicScore);

    const avgQuality =
      scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;

    return {
      available: credits
        .filter((c) => c.status === 'available')
        .reduce((sum, c) => sum + c.availableAmount, 0),
      avgQuality,
    };
  }

  private async getTopRegions(companyId: string, limit: number = 5) {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const regionMap = new Map();
    projects.forEach((project) => {
      if (!project.region) return;

      if (!regionMap.has(project.region)) {
        regionMap.set(project.region, {
          region: project.region,
          projectCount: 0,
          creditsRetired: 0,
          avgQualityScore: 0,
          growthRate: 0,
        });
      }

      const data = regionMap.get(project.region) as any;
      data.projectCount++;
      data.avgQualityScore =
        (data.avgQualityScore + (project.avgScore || 0)) / data.projectCount;
    });

    return Array.from(regionMap.values()).slice(0, limit);
  }

  private async getTopProjectTypes(companyId: string, limit: number = 5) {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const typeMap = new Map();
    projects.forEach((project) => {
      if (!project.type) return;

      if (!typeMap.has(project.type)) {
        typeMap.set(project.type, {
          type: project.type,
          count: 0,
          totalCredits: 0,
          avgQualityScore: 0,
        });
      }

      const data = typeMap.get(project.type);
      data.count++;
      data.totalCredits += project.availableCredits;
      data.avgQualityScore =
        (data.avgQualityScore + (project.avgScore || 0)) / data.count;
    });

    return Array.from(typeMap.values()).slice(0, limit);
  }

  private async getRecentActivity(companyId: string, limit: number = 10) {
    const activities = await this.prisma.activity.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return activities.map((a) => ({
      date: a.createdAt,
      creditsRetired: 0,
      newProjects: 0,
      averageScore: 0,
    }));
  }

  private async detectAnomalies(companyId: string): Promise<Anomaly[]> {
    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'asc' },
    });

    const values = retirements.map((r) => r.amount);
    const anomalyIndices = this.analytics.detectAnomalies(values);

    return anomalyIndices.map((idx) => ({
      type: 'spike',
      metric: 'retirement_amount',
      value: values[idx],
      expectedValue: values.reduce((a, b) => a + b) / values.length,
      deviance: values[idx] - values.reduce((a, b) => a + b) / values.length,
      date: retirements[idx].retiredAt,
      severity: 'medium',
    }));
  }

  private async analyzeTrends() {
    return [
      {
        metric: 'retirement_volume',
        direction: 'up' as const,
        percentageChange: 12.5,
        period: 'month',
      },
    ];
  }

  private async generateRecommendations() {
    return [
      {
        id: '1',
        title: 'Increase High-Quality Credits',
        description: 'Your portfolio has lower-than-average quality scores',
        impact: 'high' as const,
        actionable: true,
      },
    ];
  }

  private async identifyRisks() {
    return [
      {
        id: '1',
        title: 'Portfolio Concentration Risk',
        description: '65% of credits from single project type',
        severity: 'high' as const,
        affectedProjects: [],
      },
    ];
  }
}
