import { Module } from '@nestjs/common';
import { RetirementAnalyticsService } from './analytics.service';
import { RetirementAnalyticsController } from './analytics.controller';
import { PurposeBreakdownService } from './services/purpose-breakdown.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { ForecastingService } from './services/forecasting.service';
import { ImpactMetricsService } from './services/impact-metrics.service';

@Module({
  controllers: [RetirementAnalyticsController],
  providers: [
    RetirementAnalyticsService,
    PurposeBreakdownService,
    TrendAnalysisService,
    ForecastingService,
    ImpactMetricsService,
  ],
  exports: [RetirementAnalyticsService],
})
export class RetirementAnalyticsModule {}
