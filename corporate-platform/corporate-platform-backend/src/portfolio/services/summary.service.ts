import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { PortfolioSummaryMetrics } from '../interfaces/portfolio-summary.interface';

@Injectable()
export class SummaryService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getSummaryMetrics(companyId: string): Promise<PortfolioSummaryMetrics> {
    // Get portfolio for the company
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

    if (!portfolio) {
      // Return empty summary if no portfolio exists
      return {
        totalRetired: 0,
        availableBalance: 0,
        quarterlyGrowth: 0,
        netZeroProgress: 0,
        scope3Coverage: 0,
        sdgAlignment: 0,
        costEfficiency: 0,
        lastUpdatedAt: new Date(),
      };
    }

    // Get retirements data for this company
    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
    });

    const totalRetired = retirements.reduce((sum, r) => sum + r.amount, 0);

    // Calculate available balance from holdings
    const availableBalance = portfolio.holdings.reduce(
      (sum, h) => sum + h.quantity,
      0,
    );

    // Get company data for targets
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    // Calculate quarterly growth (simplified: last 3 months vs previous 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentRetirements = retirements.filter(
      (r) => r.retiredAt >= threeMonthsAgo,
    );
    const previousRetirements = retirements.filter(
      (r) => r.retiredAt >= sixMonthsAgo && r.retiredAt < threeMonthsAgo,
    );

    const recentTotal = recentRetirements.reduce((sum, r) => sum + r.amount, 0);
    const previousTotal = previousRetirements.reduce(
      (sum, r) => sum + r.amount,
      0,
    );

    const quarterlyGrowth =
      previousTotal > 0
        ? ((recentTotal - previousTotal) / previousTotal) * 100
        : 0;

    // Calculate net zero progress
    let netZeroProgress = 0;
    if (company?.netZeroTarget && company.netZeroTarget > 0) {
      netZeroProgress = Math.min(
        (totalRetired / company.netZeroTarget) * 100,
        100,
      );
    }

    // Calculate scope 3 coverage
    const scope3Retirements = retirements.filter((r) => r.purpose === 'scope3');
    const scope3Coverage =
      totalRetired > 0
        ? (scope3Retirements.reduce((sum, r) => sum + r.amount, 0) /
            totalRetired) *
          100
        : 0;

    // Calculate SDG alignment (from holdings with SDG data)
    const holdingsWithSdg = portfolio.holdings.filter((h) => h.credit.sdgs);
    const sdgAlignment =
      portfolio.holdings.length > 0
        ? (holdingsWithSdg.length / portfolio.holdings.length) * 100
        : 0;

    // Calculate cost efficiency (total value per ton retired if available)
    const totalHoldingsValue = portfolio.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0,
    );
    const costEfficiency =
      totalRetired > 0 ? totalHoldingsValue / totalRetired : 0;

    return {
      totalRetired,
      availableBalance,
      quarterlyGrowth: Math.round(quarterlyGrowth * 100) / 100,
      netZeroProgress: Math.round(netZeroProgress * 100) / 100,
      scope3Coverage: Math.round(scope3Coverage * 100) / 100,
      sdgAlignment: Math.round(sdgAlignment * 100) / 100,
      costEfficiency: Math.round(costEfficiency * 100) / 100,
      lastUpdatedAt: new Date(),
    };
  }
}
