import { Module } from '@nestjs/common';
import { RetirementAnalyticsService } from './analytics.service';
import { RetirementAnalyticsController } from './analytics.controller';
import { ApiKeyRetirementAnalyticsController } from './api-key-analytics.controller';
import { PurposeBreakdownService } from './services/purpose-breakdown.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { ForecastingService } from './services/forecasting.service';
import { ImpactMetricsService } from './services/impact-metrics.service';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [ApiKeyModule],
  controllers: [
    RetirementAnalyticsController,
    ApiKeyRetirementAnalyticsController,
  ],
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
