import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  CompositionMetrics,
  CompositionBreakdown,
} from '../interfaces/portfolio-composition.interface';

@Injectable()
export class CompositionService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getCompositionMetrics(companyId: string): Promise<CompositionMetrics> {
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
        methodologyDistribution: [],
        geographicAllocation: [],
        sdgImpact: [],
        vintageYearDistribution: [],
        projectTypeClassification: [],
      };
    }

    return {
      methodologyDistribution: this.calculateMethodologyDistribution(
        portfolio.holdings,
      ),
      geographicAllocation: this.calculateGeographicAllocation(
        portfolio.holdings,
      ),
      sdgImpact: this.calculateSdgImpact(portfolio.holdings),
      vintageYearDistribution: this.calculateVintageDistribution(
        portfolio.holdings,
      ),
      projectTypeClassification: this.calculateProjectTypes(portfolio.holdings),
    };
  }

  private calculateMethodologyDistribution(
    holdings: any[],
  ): CompositionBreakdown[] {
    const methodologyMap = new Map<string, number>();
    let total = 0;

    holdings.forEach((holding) => {
      const methodology = holding.credit.methodology || 'Unknown';
      const quantity = holding.quantity;
      const current = methodologyMap.get(methodology) || 0;
      methodologyMap.set(methodology, current + quantity);
      total += quantity;
    });

    return Array.from(methodologyMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / total) * 10000) / 100,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }

  private calculateGeographicAllocation(
    holdings: any[],
  ): CompositionBreakdown[] {
    const geoMap = new Map<string, number>();
    let total = 0;

    holdings.forEach((holding) => {
      const country = holding.credit.country || 'Unknown';
      const quantity = holding.quantity;
      const current = geoMap.get(country) || 0;
      geoMap.set(country, current + quantity);
      total += quantity;
    });

    return Array.from(geoMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / total) * 10000) / 100,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }

  private calculateSdgImpact(holdings: any[]): CompositionBreakdown[] {
    const sdgMap = new Map<string, number>();
    let total = 0;

    holdings.forEach((holding) => {
      if (holding.credit.sdgs) {
        const sdgs = holding.credit.sdgs.split(',').map((s) => s.trim());
        const quantity = holding.quantity / sdgs.length;

        sdgs.forEach((sdg) => {
          const current = sdgMap.get(sdg) || 0;
          sdgMap.set(sdg, current + quantity);
          total += quantity;
        });
      }
    });

    return Array.from(sdgMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        percentage: Math.round((value / total) * 10000) / 100,
      }))
      .sort((a, b) => b.value - a.value);
  }

  private calculateVintageDistribution(
    holdings: any[],
  ): CompositionBreakdown[] {
    const vintageMap = new Map<string, number>();
    let total = 0;

    holdings.forEach((holding) => {
      const vintage = holding.credit.vintageYear
        ? holding.credit.vintageYear.toString()
        : 'Unknown';
      const quantity = holding.quantity;
      const current = vintageMap.get(vintage) || 0;
      vintageMap.set(vintage, current + quantity);
      total += quantity;
    });

    return Array.from(vintageMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / total) * 10000) / 100,
      }))
      .sort((a, b) => Number(b.name) - Number(a.name));
  }

  private calculateProjectTypes(holdings: any[]): CompositionBreakdown[] {
    const typeMap = new Map<string, number>();
    let total = 0;

    holdings.forEach((holding) => {
      const projectType = holding.credit.standard || 'Uncertified';
      const quantity = holding.quantity;
      const current = typeMap.get(projectType) || 0;
      typeMap.set(projectType, current + quantity);
      total += quantity;
    });

    return Array.from(typeMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / total) * 10000) / 100,
      }))
      .sort((a, b) => b.value - a.value);
  }
}
