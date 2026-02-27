import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { SummaryService } from './services/summary.service';
import { PerformanceService } from './services/performance.service';
import { CompositionService } from './services/composition.service';
import { TimelineService } from './services/timeline.service';
import { RiskService } from './services/risk.service';

@Module({
  providers: [
    PortfolioService,
    SummaryService,
    PerformanceService,
    CompositionService,
    TimelineService,
    RiskService,
  ],
  controllers: [PortfolioController],
  exports: [
    PortfolioService,
    SummaryService,
    PerformanceService,
    CompositionService,
    TimelineService,
    RiskService,
  ],
})
export class PortfolioModule {}
