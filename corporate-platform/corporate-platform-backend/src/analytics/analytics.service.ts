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

  /**
   * Get or create cached analytics data
   */
  async getCachedMetrics(
    metricType: string,
    period: string,
    date: Date,
    companyId?: string,
  ) {
    const cacheKey = this.buildCacheKey(metricType, period, date, companyId);

    // Try to get from Redis first
    const cached = await this.cache.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    return null;
  }

  /**
   * Cache analytics metrics
   */
  async cacheMetrics(
    metricType: string,
    period: string,
    date: Date,
    data: any,
    companyId?: string,
    ttlMinutes: number = 60,
  ) {
    const cacheKey = this.buildCacheKey(metricType, period, date, companyId);

    // Cache in Redis
    await this.cache.set(cacheKey, JSON.stringify(data), ttlMinutes * 60);

    // Also store in database for persistence
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.prisma.analyticsCache.create({
      data: {
        metricType,
        period,
        date,
        companyId,
        data,
        expiresAt,
      },
    });
  }

  /**
   * Build cache key for metrics
   */
  private buildCacheKey(
    metricType: string,
    period: string,
    date: Date,
    companyId?: string,
  ): string {
    return `analytics:${metricType}:${period}:${date.toISOString()}:${companyId || 'global'}`;
  }

  /**
   * Clear expired cached data
   */
  async cleanupExpiredCache() {
    const result = await this.prisma.analyticsCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.debug(`Cleaned up ${result.count} expired cache entries`);
    return result;
  }

  /**
   * Get date range for analytics
   */
  getDateRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return {
      startDate: start,
      endDate: end,
      days: Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      ),
    };
  }

  /**
   * Format data for chart visualization
   */
  formatChartData(data: any[], labels: string[], datasets: any[]) {
    return {
      labels,
      datasets,
      meta: {
        generatedAt: new Date(),
        dataPoints: data.length,
      },
    };
  }

  /**
   * Calculate percentage change
   */
  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate rolling average
   */
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

  /**
   * Calculate percentile rank
   */
  calculatePercentileRank(value: number, allValues: number[]): number {
    if (allValues.length === 0) return 0;

    const sorted = [...allValues].sort((a, b) => a - b);

    // Special case: if value is the minimum, return 0
    if (value <= sorted[0]) {
      return 0;
    }

    // Use standard percentile rank: (count <= value) / total * 100
    const count = sorted.filter((v) => v <= value).length;
    return (count / sorted.length) * 100;
  }

  /**
   * Detect anomalies using statistical methods
   */
  detectAnomalies(
    data: number[],
    threshold: number = 2, // standard deviations
  ): number[] {
    if (data.length < 2) return [];

    const mean = data.reduce((a, b) => a + b) / data.length;
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return data
      .map((val, idx) => ({
        index: idx,
        value: val,
        zScore: (val - mean) / stdDev,
        isAnomaly: Math.abs((val - mean) / stdDev) > threshold,
      }))
      .filter((item) => item.isAnomaly)
      .map((item) => item.index);
  }

  /**
   * Ensure multi-tenant isolation
   */
  ensureMultiTenantAccess(companyId: string, dataCompanyId: string | null) {
    if (dataCompanyId !== null && dataCompanyId !== companyId) {
      return false;
    }
    return true;
  }
}
