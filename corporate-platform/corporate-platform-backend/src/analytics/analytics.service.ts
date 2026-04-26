import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  private logger = new Logger('AnalyticsService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getCachedMetrics(
    metricType: string,
    period: string,
    date: Date,
    companyId?: string,
  ) {
    const cacheKey = this.buildCacheKey(metricType, period, date, companyId);
    const cached = await this.cache.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }
    return null;
  }

  async cacheMetrics(
    metricType: string,
    period: string,
    date: Date,
    data: any,
    companyId?: string,
    ttlMinutes: number = 60,
  ) {
    const cacheKey = this.buildCacheKey(metricType, period, date, companyId);
    await this.cache.set(cacheKey, JSON.stringify(data), ttlMinutes * 60);
    // Redis cache only - database cache removed to avoid Prisma errors
    return;
  }

  private buildCacheKey(
    metricType: string,
    period: string,
    date: Date,
    companyId?: string,
  ): string {
    return `analytics:${metricType}:${period}:${date.toISOString()}:${companyId || 'global'}`;
  }

  async cleanupExpiredCache() {
    // Redis handles TTL automatically - no database cleanup needed
    this.logger.debug('Cache cleanup handled by Redis TTL');
    return { count: 0 };
  }

  getDateRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return {
      startDate: start,
      endDate: end,
      days: Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  formatChartData(data: any[], labels: string[], datasets: any[]) {
    return {
      labels,
      datasets,
      meta: { generatedAt: new Date(), dataPoints: data.length },
    };
  }

  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  calculateRollingAverage(data: number[], windowSize: number): number[] {
    if (data.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = data.slice(start, i + 1);
      const average = window.reduce((a, b) => a + b, 0) / window.length;
      result.push(average);
    }
    return result;
  }

  calculatePercentileRank(value: number, allValues: number[]): number {
    if (allValues.length === 0) return 0;
    const sorted = [...allValues].sort((a, b) => a - b);
    if (value <= sorted[0]) return 0;
    const count = sorted.filter((v) => v <= value).length;
    return (count / sorted.length) * 100;
  }

  detectAnomalies(data: number[], threshold: number = 2): number[] {
    if (data.length < 2) return [];
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    return data
      .map((val, idx) => ({ index: idx, value: val, zScore: (val - mean) / stdDev, isAnomaly: Math.abs((val - mean) / stdDev) > threshold }))
      .filter((item) => item.isAnomaly)
      .map((item) => item.index);
  }

  ensureMultiTenantAccess(companyId: string, dataCompanyId: string | null) {
    if (dataCompanyId !== null && dataCompanyId !== companyId) {
      return false;
    }
    return true;
  }

  // ========== RETIREMENT DATA AGGREGATION (Issue #237) ==========

  async getRetirementSummary(companyId: string, period: string = 'MONTHLY') {
    const cacheKey = `retirement_summary:${companyId}:${period}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached as string); } catch { return cached; }
    }

    const retirements = await (this.prisma as any).retirement.findMany({
      where: { companyId },
    });

    const totalRetired = retirements.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const totalTransactions = retirements.length;
    const uniqueEntities = new Set(retirements.map((r: any) => r.userId)).size;

    const now = new Date();
    const thisMonthTotal = retirements
      .filter((r: any) => {
        const d = new Date(r.retiredAt || r.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const lastMonthTotal = retirements
      .filter((r: any) => {
        const d = new Date(r.retiredAt || r.createdAt);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      })
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    const result = {
      summary: {
        totalRetired,
        totalTransactions,
        uniqueEntities,
        averagePerTransaction: totalTransactions > 0 ? totalRetired / totalTransactions : 0,
      },
      trends: {
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        percentageChange: lastMonthTotal === 0 ? 0 : ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100,
      },
      updatedAt: new Date(),
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  async getRetirementTrends(companyId: string, months: number = 12) {
    const cacheKey = `retirement_trends:${companyId}:${months}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached as string); } catch { return cached; }
    }

    const retirements = await (this.prisma as any).retirement.findMany({
      where: { companyId },
    });

    const monthlyData: { [key: string]: number } = {};
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyData[key] = 0;
    }

    for (const r of retirements) {
      const date = new Date(r.retiredAt || r.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (monthlyData[key] !== undefined) {
        monthlyData[key] += r.amount || 0;
      }
    }

    const result = {
      labels: Object.keys(monthlyData),
      datasets: [{
        label: 'Carbon Retired (tons)',
        data: Object.values(monthlyData),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
      }],
      meta: { generatedAt: new Date(), monthsIncluded: months },
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  async getRetirementBreakdown(companyId: string, dimension: string = 'entity') {
    const cacheKey = `retirement_breakdown:${companyId}:${dimension}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached as string); } catch { return cached; }
    }

    const retirements = await (this.prisma as any).retirement.findMany({
      where: { companyId },
    });

    const breakdownMap = new Map<string, number>();
    for (const r of retirements) {
      let key = '';
      if (dimension === 'entity') {
        key = r.userId;
      } else if (dimension === 'assetType') {
        key = r.purpose || 'carbon_credit';
      } else {
        const date = new Date(r.retiredAt || r.createdAt);
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      }
      breakdownMap.set(key, (breakdownMap.get(key) || 0) + (r.amount || 0));
    }

    const breakdown = Array.from(breakdownMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const result = {
      dimension,
      data: breakdown,
      total: breakdown.reduce((sum, item) => sum + item.value, 0),
      updatedAt: new Date(),
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }
}
