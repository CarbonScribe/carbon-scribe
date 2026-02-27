import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  RiskMetrics,
  ConcentrationAnalysis,
  QualityDistribution,
} from '../interfaces/portfolio-risk.interface';

@Injectable()
export class RiskService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getRiskMetrics(companyId: string): Promise<RiskMetrics> {
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
        diversificationScore: 0,
        riskRating: 'Low',
        concentrationAnalysis: {
          topProject: { name: 'N/A', percentage: 0 },
          topCountry: { name: 'N/A', percentage: 0 },
          herfindahlIndex: 0,
        },
        volatility: 0,
        projectQualityDistribution: {
          highQuality: 0,
          mediumQuality: 0,
          lowQuality: 0,
        },
      };
    }

    const totalQuantity = portfolio.holdings.reduce(
      (sum, h) => sum + h.quantity,
      0,
    );

    const diversificationScore = this.calculateDiversificationScore(
      portfolio.holdings,
      totalQuantity,
    );
    const concentrationAnalysis = this.calculateConcentrationAnalysis(
      portfolio.holdings,
      totalQuantity,
    );
    const volatility = this.calculateVolatility(portfolio.holdings);
    const qualityDistribution = this.calculateQualityDistribution(
      portfolio.holdings,
    );

    // Determine risk rating based on diversification and concentration
    const riskRating = this.determineRiskRating(
      diversificationScore,
      concentrationAnalysis.herfindahlIndex,
    );

    return {
      diversificationScore,
      riskRating,
      concentrationAnalysis,
      volatility,
      projectQualityDistribution: qualityDistribution,
    };
  }

  private calculateDiversificationScore(
    holdings: any[],
    totalQuantity: number,
  ): number {
    if (holdings.length === 0) return 0;
    if (holdings.length === 1) return 0; // Single holding = no diversification

    // Calculate Herfindahl-Hirschman Index (HHI)
    const hhi = holdings.reduce((sum, holding) => {
      const percentage = (holding.quantity / totalQuantity) * 100;
      return sum + percentage * percentage;
    }, 0);

    // Convert HHI to diversification score (0-100)
    // HHI ranges from 10000/N (perfect diversification) to 10000 (full concentration)
    const minHhi = 10000 / holdings.length; // Perfect equal distribution
    const maxHhi = 10000; // Full concentration (all in one)

    // Score: higher diversification = higher score
    const diversificationScore = ((maxHhi - hhi) / (maxHhi - minHhi)) * 100;

    return Math.round(Math.max(0, Math.min(100, diversificationScore)));
  }

  private calculateConcentrationAnalysis(
    holdings: any[],
    totalQuantity: number,
  ): ConcentrationAnalysis {
    // Calculate project concentration
    const projectMap = new Map<string, number>();
    const countryMap = new Map<string, number>();

    holdings.forEach((holding) => {
      const projectId = holding.credit.projectId || 'Unknown';
      const country = holding.credit.country || 'Unknown';

      projectMap.set(
        projectId,
        (projectMap.get(projectId) || 0) + holding.quantity,
      );
      countryMap.set(
        country,
        (countryMap.get(country) || 0) + holding.quantity,
      );
    });

    // Find top project and country
    let topProject = { name: 'Unknown', percentage: 0 };
    let topCountry = { name: 'Unknown', percentage: 0 };

    for (const [projectId, quantity] of projectMap.entries()) {
      const percentage = (quantity / totalQuantity) * 100;
      if (percentage > topProject.percentage) {
        topProject = {
          name: projectId,
          percentage: Math.round(percentage * 100) / 100,
        };
      }
    }

    for (const [country, quantity] of countryMap.entries()) {
      const percentage = (quantity / totalQuantity) * 100;
      if (percentage > topCountry.percentage) {
        topCountry = {
          name: country,
          percentage: Math.round(percentage * 100) / 100,
        };
      }
    }

    // Calculate Herfindahl Index
    const herfindahlIndex = Array.from(projectMap.values()).reduce(
      (sum, quantity) => {
        const percentage = (quantity / totalQuantity) * 100;
        return sum + percentage * percentage;
      },
      0,
    );

    return {
      topProject,
      topCountry,
      herfindahlIndex: Math.round(herfindahlIndex * 100) / 100,
    };
  }

  private calculateVolatility(holdings: any[]): number {
    if (holdings.length < 2) return 0;

    // Simple volatility calculation based on price variance
    const prices = holdings.map((h) => h.purchasePrice);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    const variance =
      prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) /
      prices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / avgPrice) * 100;

    return Math.round(volatility * 100) / 100;
  }

  private calculateQualityDistribution(holdings: any[]): QualityDistribution {
    // Assume high quality if standard is recognized (VCS, Gold Standard, etc.)
    // Medium quality for less known standards
    // Low for uncertified

    const highQualityStandards = ['VCS', 'Gold Standard', 'CAR', 'ACR'];
    const mediumQualityStandards = ['Plan Vivo', 'CCB'];

    let highQuality = 0;
    let mediumQuality = 0;
    let lowQuality = 0;

    holdings.forEach((holding) => {
      const standard = holding.credit.standard || '';
      if (highQualityStandards.some((s) => standard.includes(s))) {
        highQuality += holding.quantity;
      } else if (mediumQualityStandards.some((s) => standard.includes(s))) {
        mediumQuality += holding.quantity;
      } else {
        lowQuality += holding.quantity;
      }
    });

    const total = highQuality + mediumQuality + lowQuality;

    return {
      highQuality:
        total > 0 ? Math.round((highQuality / total) * 10000) / 100 : 0,
      mediumQuality:
        total > 0 ? Math.round((mediumQuality / total) * 10000) / 100 : 0,
      lowQuality:
        total > 0 ? Math.round((lowQuality / total) * 10000) / 100 : 0,
    };
  }

  private determineRiskRating(
    diversificationScore: number,
    herfindahlIndex: number,
  ): 'Low' | 'Medium' | 'High' {
    // High risk: low diversification AND high concentration
    if (diversificationScore < 40 && herfindahlIndex > 3000) {
      return 'High';
    }

    // Medium risk: moderate diversification or concentration
    if (
      diversificationScore < 60 ||
      (herfindahlIndex > 2000 && diversificationScore < 70)
    ) {
      return 'Medium';
    }

    // Low risk: good diversification and low concentration
    return 'Low';
  }
}
