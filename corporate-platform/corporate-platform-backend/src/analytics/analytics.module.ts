import { Module } from '@nestjs/common';
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
import { CacheService } from '../cache/cache.service';

@Module({
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
    CacheService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
