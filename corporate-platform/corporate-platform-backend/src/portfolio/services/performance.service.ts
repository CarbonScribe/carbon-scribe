import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  PerformanceMetrics,
  PerformanceTrendPoint,
} from '../interfaces/portfolio-performance.interface';

@Injectable()
export class PerformanceService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getPerformanceMetrics(companyId: string): Promise<PerformanceMetrics> {
    // Get portfolio with all holdings
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { companyId },
      include: {
        holdings: {
          include: {
            credit: true,
          },
        },
      },
    });

    if (!portfolio || portfolio.holdings.length === 0) {
      return {
        portfolioValue: 0,
        avgPricePerTon: 0,
        creditsHeld: 0,
        projectDiversity: 0,
        performanceTrends: [],
        monthlyRetirements: [],
      };
    }

    // Calculate portfolio value
    const portfolioValue = portfolio.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0,
    );

    // Calculate total credits held
    const creditsHeld = portfolio.holdings.reduce(
      (sum, h) => sum + h.quantity,
      0,
    );

    // Calculate average price per ton
    const totalCost = portfolio.holdings.reduce(
      (sum, h) => sum + h.purchasePrice * h.quantity,
      0,
    );
    const avgPricePerTon = creditsHeld > 0 ? totalCost / creditsHeld : 0;

    // Calculate project diversity (unique projects)
    const uniqueProjects = new Set(
      portfolio.holdings.map((h) => h.credit.projectId),
    ).size;
    const projectDiversity =
      portfolio.holdings.length > 0
        ? (uniqueProjects / portfolio.holdings.length) * 100
        : 0;

    // Get retirements for performance trends
    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'asc' },
    });

    // Calculate performance trends (monthly)
    const performanceTrends = this.calculateMonthlyTrends(retirements);

    // Calculate monthly retirements
    const monthlyRetirements = this.calculateMonthlyRetirements(retirements);

    return {
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      avgPricePerTon: Math.round(avgPricePerTon * 100) / 100,
      creditsHeld,
      projectDiversity: Math.round(projectDiversity * 100) / 100,
      performanceTrends,
      monthlyRetirements,
    };
  }

  private calculateMonthlyTrends(retirements: any[]): PerformanceTrendPoint[] {
    const trendMap = new Map<string, number>();

    retirements.forEach((retirement) => {
      const date = new Date(retirement.retiredAt);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`;

      const currentValue = trendMap.get(monthKey) || 0;
      trendMap.set(monthKey, currentValue + retirement.amount);
    });

    return Array.from(trendMap.entries())
      .map(([month, value]) => ({
        month,
        value,
      }))
      .slice(-12); // Last 12 months
  }

  private calculateMonthlyRetirements(
    retirements: any[],
  ): PerformanceTrendPoint[] {
    const retirementMap = new Map<string, number>();

    retirements.forEach((retirement) => {
      const date = new Date(retirement.retiredAt);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`;

      const currentCount = retirementMap.get(monthKey) || 0;
      retirementMap.set(monthKey, currentCount + 1);
    });

    return Array.from(retirementMap.entries())
      .map(([month, count]) => ({
        month,
        value: count,
      }))
      .slice(-12); // Last 12 months
  }
}
