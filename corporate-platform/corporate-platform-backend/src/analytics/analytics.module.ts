import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

import { DashboardService } from './services/dashboard.service';
import { PredictiveService } from './services/predictive.service';
import { CreditQualityService } from './services/credit-quality.service';
import { PerformanceService } from './services/performance.service';
import { ProjectComparisonService } from './services/project-comparison.service';
import { RegionalService } from './services/regional.service';
import { TeamPerformanceService } from './services/team-performance.service';
import { TimelineService } from './services/timeline.service';

import { PrismaService } from '../shared/database/prisma.service';
import { CacheModule } from '../cache/cache.module';

import { RetirementAggregationService } from './services/retirement-aggregation.service';
import { RetirementAggregationHandler } from './services/retirement-aggregation.handler';
import {
  RetirementAggregation,
  RetirementAggregationSchema,
} from './schemas/retirement-aggregation.schema';
import { WebhookDispatcherService } from '../webhooks/services/webhook-dispatcher.service';

@Module({
  imports: [
    CacheModule,
    MongooseModule.forFeature([
      { name: RetirementAggregation.name, schema: RetirementAggregationSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    DashboardService,
    PredictiveService,
    CreditQualityService,
    PerformanceService,
    ProjectComparisonService,
    RegionalService,
    TeamPerformanceService,
    TimelineService,
    PrismaService,
    RetirementAggregationService,
    RetirementAggregationHandler,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {
  constructor(
    private readonly dispatcher: WebhookDispatcherService,
    private readonly retirementAggregationHandler: RetirementAggregationHandler,
  ) {
    this.dispatcher.registerHandler(this.retirementAggregationHandler);
  }
}
