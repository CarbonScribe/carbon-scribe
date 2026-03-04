import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { SummaryService } from './services/summary.service';
import { PerformanceService } from './services/performance.service';
import { CompositionService } from './services/composition.service';
import { TimelineService } from './services/timeline.service';
import { RiskService } from './services/risk.service';

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private summaryService: SummaryService,
    private performanceService: PerformanceService,
    private compositionService: CompositionService,
    private timelineService: TimelineService,
    private riskService: RiskService,
  ) {}

  async getPortfolioSummary(companyId: string) {
    return this.summaryService.getSummaryMetrics(companyId);
  }

  async getPortfolioPerformance(companyId: string) {
    return this.performanceService.getPerformanceMetrics(companyId);
  }

  async getPortfolioComposition(companyId: string) {
    return this.compositionService.getCompositionMetrics(companyId);
  }

  async getPortfolioTimeline(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.timelineService.getTimelineMetrics(
      companyId,
      startDate,
      endDate,
    );
  }

  async getPortfolioRisk(companyId: string) {
    return this.riskService.getRiskMetrics(companyId);
  }

  async getPortfolioHoldings(
    companyId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { companyId },
    });

    if (!portfolio) {
      return {
        data: [],
        total: 0,
        page,
        pageSize,
      };
    }

    const skip = (page - 1) * pageSize;

    const [holdings, total] = await Promise.all([
      this.prisma.portfolioHolding.findMany({
        where: { portfolioId: portfolio.id },
        include: { credit: true },
        skip,
        take: pageSize,
        orderBy: { quantity: 'desc' },
      }),
      this.prisma.portfolioHolding.count({
        where: { portfolioId: portfolio.id },
      }),
    ]);

    return {
      data: holdings,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }

  async getPortfolioAnalytics(companyId: string) {
    const [summary, performance, composition, timeline, risk] =
      await Promise.all([
        this.getPortfolioSummary(companyId),
        this.getPortfolioPerformance(companyId),
        this.getPortfolioComposition(companyId),
        this.getPortfolioTimeline(companyId),
        this.getPortfolioRisk(companyId),
      ]);

    return {
      summary,
      performance,
      composition,
      timeline,
      risk,
      generatedAt: new Date(),
    };
  }
}
