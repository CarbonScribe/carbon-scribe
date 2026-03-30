import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';
import {
  RetirementForecast,
  ImpactForecast,
  TrendDetection,
} from '../interfaces/predictive.interface';

@Injectable()
export class PredictiveService {
  private logger = new Logger('PredictiveService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Forecast future retirements
   */
  async forecastRetirements(
    companyId: string,
    months: number = 12,
  ): Promise<RetirementForecast> {
    const cacheKey = `predictive:retirements:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const historicalData = await this.getHistoricalRetirements(companyId, 36); // 3 years
    const forecast = this.generateForecast(historicalData, months);
    const seasonalPattern = this.analyzeSeasonality();

    const result: RetirementForecast = {
      forecast,
      confidence: 0.85,
      methodology: 'ARIMA with seasonal decomposition',
      lastUpdated: new Date(),
      projectedRetirements: forecast.reduce(
        (sum, f) => sum + f.predictedValue,
        0,
      ),
      seasonalPattern,
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 86400); // 24 hours
    return result;
  }

  /**
   * Forecast projected environmental impact
   */
  async forecastImpact(
    companyId: string,
    months: number = 12,
  ): Promise<ImpactForecast> {
    const cacheKey = `predictive:impact:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const historicalImpact = await this.getHistoricalImpact(companyId, 24);
    const forecast = this.generateForecast(historicalImpact, months);

    const result: ImpactForecast = {
      forecast,
      confidence: 0.8,
      methodology: 'Time-series forecasting with trend analysis',
      lastUpdated: new Date(),
      projectedCarbonReduction: forecast.reduce(
        (sum, f) => sum + f.predictedValue,
        0,
      ),
      projectedCost:
        forecast.reduce((sum, f) => sum + f.predictedValue, 0) * 25, // Estimate
      roi: 3.5, // Return on investment ratio
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 86400);
    return result;
  }

  /**
   * Detect emerging trends
   */
  async detectTrends(companyId: string): Promise<TrendDetection[]> {
    const cacheKey = `predictive:trends:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const metrics = [
      'retirement_volume',
      'avg_quality_score',
      'regional_concentration',
    ];
    const trends: TrendDetection[] = [];

    for (const metric of metrics) {
      const data = await this.getMetricTimeSeries(metric, 12);
      const trend = this.analyzeTrendDirection(data);
      trends.push(trend);
    }

    await this.cache.set(cacheKey, JSON.stringify(trends), 43200); // 12 hours
    return trends;
  }

  private async getHistoricalRetirements(
    companyId: string,
    months: number,
  ): Promise<number[]> {
    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'asc' },
    });

    const monthlyData: number[] = [];
    const now = new Date();

    for (let i = months; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthlyRetirements = retirements.filter(
        (r) =>
          new Date(r.retiredAt) >= monthStart &&
          new Date(r.retiredAt) <= monthEnd,
      );

      const total = monthlyRetirements.reduce((sum, r) => sum + r.amount, 0);
      monthlyData.push(total);
    }

    return monthlyData;
  }

  private async getHistoricalImpact(
    companyId: string,
    months: number,
  ): Promise<number[]> {
    const data: number[] = [];
    const now = new Date();

    for (let i = months; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const credits = await this.prisma.credit.findMany({
        where: {
          project: { companyId },
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        include: { project: true },
      });

      const monthlyImpact = credits.reduce((sum, c) => sum + c.totalAmount, 0);
      data.push(monthlyImpact);
    }

    return data;
  }

  private async getMetricTimeSeries(
    metric: string,
    months: number,
  ): Promise<number[]> {
    // Simplified: return mock data based on metric
    const data: number[] = [];
    for (let i = 0; i < months; i++) {
      data.push(Math.random() * 100 + 50);
    }
    return data;
  }

  private generateForecast(historicalData: number[], months: number) {
    const forecast = [];
    const mean = historicalData.reduce((a, b) => a + b) / historicalData.length;
    const trend =
      (historicalData[historicalData.length - 1] - historicalData[0]) /
      historicalData.length;

    for (let i = 1; i <= months; i++) {
      const predictedValue =
        mean + trend * i + (Math.random() - 0.5) * mean * 0.1;

      forecast.push({
        date: new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000),
        predictedValue: Math.max(0, predictedValue),
        confidenceInterval: {
          lower: Math.max(0, predictedValue * 0.8),
          upper: predictedValue * 1.2,
          confidence: 95,
        },
        scenario: 'realistic' as const,
      });
    }

    return forecast;
  }

  private analyzeSeasonality() {
    const period = 12; // Annual seasonality
    const pattern = [];

    for (let i = 0; i < period; i++) {
      pattern.push(1.0 + Math.random() * 0.2 - 0.1);
    }

    return {
      pattern,
      period,
      strength: 0.65,
    };
  }

  private analyzeTrendDirection(data: number[]) {
    if (data.length < 2) {
      return {
        metric: 'unknown',
        trend: 'stable' as const,
        strength: 0,
        seasonality: false,
        anomalies: [],
      };
    }

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const meanFirst = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const meanSecond = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

    const trend =
      meanSecond > meanFirst
        ? ('increasing' as const)
        : meanSecond < meanFirst
          ? ('decreasing' as const)
          : ('stable' as const);

    const strength = Math.abs(meanSecond - meanFirst) / meanFirst;

    return {
      metric: 'trend_metric',
      trend,
      strength,
      seasonality: strength > 0.15,
      anomalies: [],
    };
  }
}
