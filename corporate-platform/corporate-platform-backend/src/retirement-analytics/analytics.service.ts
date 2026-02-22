import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { PurposeBreakdownService } from './services/purpose-breakdown.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { ForecastingService } from './services/forecasting.service';
import { ImpactMetricsService } from './services/impact-metrics.service';
import { PurposeBreakdownResponse } from './interfaces/purpose-breakdown.interface';
import { TrendDataResponse } from './interfaces/trend-data.interface';
import { ForecastResponse } from './interfaces/forecast.interface';
import { ImpactMetricsResponse } from './interfaces/impact-metrics.interface';
import { ProgressResponse } from './interfaces/progress.interface';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class RetirementAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purposeBreakdownService: PurposeBreakdownService,
    private readonly trendAnalysisService: TrendAnalysisService,
    private readonly forecastingService: ForecastingService,
    private readonly impactMetricsService: ImpactMetricsService,
  ) {}

  async getPurposeBreakdown(
    query: AnalyticsQueryDto,
  ): Promise<PurposeBreakdownResponse> {
    const { companyId, startDate, endDate } = this.parseQuery(query);
    return this.purposeBreakdownService.getBreakdown(
      companyId,
      startDate,
      endDate,
    );
  }

  async getTrends(query: AnalyticsQueryDto): Promise<TrendDataResponse> {
    const { companyId, startDate, endDate } = this.parseQuery(query);
    return this.trendAnalysisService.getTrends(
      companyId,
      query.aggregation || 'monthly',
      startDate,
      endDate,
    );
  }

  async getForecast(query: AnalyticsQueryDto): Promise<ForecastResponse> {
    const { companyId } = this.parseQuery(query);
    return this.forecastingService.getForecast(companyId);
  }

  async getImpactMetrics(
    query: AnalyticsQueryDto,
  ): Promise<ImpactMetricsResponse> {
    const { companyId, startDate, endDate } = this.parseQuery(query);
    return this.impactMetricsService.getImpactMetrics(
      companyId,
      startDate,
      endDate,
    );
  }

  async getProgress(query: AnalyticsQueryDto): Promise<ProgressResponse> {
    const { companyId } = this.parseQuery(query);
    const currentYear = new Date().getFullYear();

    // Fetch company configuration
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return {
        annual: { target: 0, achieved: 0, percentage: 0 },
        netZero: { target: 0, achieved: 0, percentage: 0 },
        onTrack: false,
        behindScheduleAlert: false,
      };
    }

    // Calculate annual progress
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const annualResult = await this.prisma.retirement.aggregate({
      where: {
        companyId,
        retiredAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { amount: true },
    });

    const annualAchieved = annualResult._sum.amount || 0;
    const annualTarget = company.annualRetirementTarget || 0;
    const annualPercentage =
      annualTarget > 0
        ? Math.round((annualAchieved / annualTarget) * 10000) / 100
        : 0;

    // Calculate net-zero progress (lifetime total vs target)
    const lifetimeResult = await this.prisma.retirement.aggregate({
      where: { companyId },
      _sum: { amount: true },
    });

    const lifetimeAchieved = lifetimeResult._sum.amount || 0;
    const netZeroTarget = company.netZeroTarget || 0;
    const netZeroPercentage =
      netZeroTarget > 0
        ? Math.round((lifetimeAchieved / netZeroTarget) * 10000) / 100
        : 0;

    // Calculate projected completion date for annual target
    let projectedCompletionDate: string | undefined;
    if (
      annualTarget > 0 &&
      annualAchieved > 0 &&
      annualAchieved < annualTarget
    ) {
      const now = new Date();
      const dayOfYear = Math.floor(
        (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const dailyRate = annualAchieved / Math.max(dayOfYear, 1);
      const remainingAmount = annualTarget - annualAchieved;
      const daysNeeded = Math.ceil(remainingAmount / dailyRate);
      const completionDate = new Date(now.getTime() + daysNeeded * 86400000);
      projectedCompletionDate = completionDate.toISOString().split('T')[0];
    }

    // Determine if on track: percentage should roughly match the proportion of the year elapsed
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const yearProgress = (dayOfYear / 365) * 100;
    const onTrack = annualPercentage >= yearProgress * 0.9; // within 10% of expected pace

    // Behind-schedule alert: triggers when pace is below 80% of expected
    const behindScheduleAlert =
      annualTarget > 0 && annualPercentage < yearProgress * 0.8;
    let alertMessage: string | undefined;
    if (behindScheduleAlert) {
      const deficit = Math.round(
        annualTarget * (yearProgress / 100) - annualAchieved,
      );
      alertMessage = `Behind schedule: ${deficit} tonnes CO₂ below expected pace for annual target. Current progress is ${annualPercentage.toFixed(1)}% vs expected ${yearProgress.toFixed(1)}%.`;
    }

    return {
      annual: {
        target: annualTarget,
        achieved: annualAchieved,
        percentage: Math.min(annualPercentage, 100),
        projectedCompletionDate,
      },
      netZero: {
        target: netZeroTarget,
        achieved: lifetimeAchieved,
        percentage: Math.min(netZeroPercentage, 100),
      },
      onTrack,
      behindScheduleAlert,
      alertMessage,
    };
  }

  async getSummary(query: AnalyticsQueryDto) {
    const [purposeBreakdown, trends, forecast, impact, progress] =
      await Promise.all([
        this.getPurposeBreakdown(query),
        this.getTrends(query),
        this.getForecast(query),
        this.getImpactMetrics(query),
        this.getProgress(query),
      ]);

    return {
      purposeBreakdown,
      trends,
      forecast,
      impact,
      progress,
    };
  }

  private parseQuery(query: AnalyticsQueryDto): {
    companyId: string;
    startDate?: Date;
    endDate?: Date;
  } {
    return {
      companyId: query.companyId || '',
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };
  }
}
