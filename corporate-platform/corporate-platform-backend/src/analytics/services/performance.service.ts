import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';
import {
  PerformanceTimeSeries,
  MetricBreakdown,
  PerformanceRanking,
} from '../interfaces/performance.interface';

@Injectable()
export class PerformanceService {
  private logger = new Logger('PerformanceService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Get performance metrics over time
   */
  async getPerformanceOverTime(
    companyId: string,
    metric: string,
    startDate: string,
    endDate: string,
    aggregation: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ): Promise<PerformanceTimeSeries> {
    const cacheKey = `perf:timeline:${companyId}:${metric}:${aggregation}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const dateRange = this.analytics.getDateRange(startDate, endDate);
    const data = await this.aggregateMetricsByPeriod(
      companyId,
      metric,
      dateRange.startDate,
      dateRange.endDate,
      aggregation,
    );

    const timeSeries: PerformanceTimeSeries = {
      metric,
      data,
      aggregation,
    };

    await this.cache.set(cacheKey, JSON.stringify(timeSeries), 3600);
    return timeSeries;
  }

  /**
   * Get metric breakdown by dimension
   */
  async getMetricBreakdown(
    companyId: string,
    metric: string,
    dimension: string = 'projectType',
  ): Promise<MetricBreakdown> {
    const cacheKey = `perf:breakdown:${companyId}:${metric}:${dimension}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const breakdown: Record<string, number> = {};
    let totalValue = 0;

    projects.forEach((project) => {
      const dimValue =
        dimension === 'projectType' ? project.type : project.region;
      const value = project.credits.reduce((sum, c) => sum + c.totalAmount, 0);

      if (dimValue) {
        breakdown[dimValue] = (breakdown[dimValue] || 0) + value;
      }
      totalValue += value;
    });

    const result: MetricBreakdown = {
      metric,
      totalValue,
      byDimension: Object.entries(breakdown).map(([dim, value]) => ({
        dimension: dim,
        value,
        percentage: (value / totalValue) * 100,
      })),
      distribution: breakdown,
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get performance rankings
   */
  async getPerformanceRankings(
    companyId: string,
    metric: string,
    period: string = 'MONTHLY',
  ): Promise<PerformanceRanking> {
    const cacheKey = `perf:ranking:${companyId}:${metric}:${period}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const scores = projects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      value:
        metric === 'credits'
          ? p.availableCredits
          : metric === 'quality'
            ? p.avgScore || 0
            : p.credits.length,
    }));

    scores.sort((a, b) => b.value - a.value);

    const rankings = scores.map((score, idx) => ({
      rank: idx + 1,
      projectId: score.projectId,
      projectName: score.projectName,
      value: score.value,
      percentile: this.analytics.calculatePercentileRank(
        score.value,
        scores.map((s) => s.value),
      ),
    }));

    const result: PerformanceRanking = {
      metric,
      rankings,
      period,
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  private async aggregateMetricsByPeriod(
    companyId: string,
    metric: string,
    startDate: Date,
    endDate: Date,
    aggregation: string,
  ) {
    const retirements = await this.prisma.retirement.findMany({
      where: {
        companyId,
        retiredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { retiredAt: 'asc' },
    });

    const periodMap = new Map();

    retirements.forEach((retirement) => {
      const periodKey = this.getPeriodKey(retirement.retiredAt, aggregation);

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          date: new Date(periodKey),
          value: 0,
        });
      }

      const data = periodMap.get(periodKey);
      data.value += retirement.amount;
    });

    return Array.from(periodMap.values()).map((item, idx, arr) => ({
      date: item.date,
      value: item.value,
      previousPeriod: idx > 0 ? arr[idx - 1].value : undefined,
      change: idx > 0 ? item.value - arr[idx - 1].value : undefined,
      percentageChange:
        idx > 0
          ? this.analytics.calculatePercentageChange(
              item.value,
              arr[idx - 1].value,
            )
          : undefined,
    }));
  }

  private getPeriodLength(aggregation: string): number {
    switch (aggregation) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'monthly':
        return 30;
      default:
        return 30;
    }
  }

  private getPeriodKey(date: Date, aggregation: string): string {
    const d = new Date(date);

    if (aggregation === 'daily') {
      return d.toISOString().split('T')[0];
    } else if (aggregation === 'weekly') {
      const week = Math.floor(d.getDate() / 7);
      return `${d.getFullYear()}-W${week}`;
    } else {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
}
