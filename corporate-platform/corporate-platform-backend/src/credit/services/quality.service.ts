import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class QualityService {
  constructor(private prisma: PrismaService) {}

  async getQualityMetrics(id: string) {
    const credit = await this.prisma.credit.findUnique({
      where: { id },
      select: {
        dynamicScore: true,
        verificationScore: true,
        additionalityScore: true,
        permanenceScore: true,
        leakageScore: true,
        cobenefitsScore: true,
        transparencyScore: true,
      },
    });

    return credit;
  }

  /**
   * Calculates the dynamic score based on component metrics.
   * Weighting:
   * - Verification: 25%
   * - Additionality: 20%
   * - Permanence: 15%
   * - Leakage: 10%
   * - Co-benefits: 20%
   * - Transparency: 10%
   */
  calculateDynamicScore(metrics: {
    verificationScore: number;
    additionalityScore: number;
    permanenceScore: number;
    leakageScore: number;
    cobenefitsScore: number;
    transparencyScore: number;
  }): number {
    const score =
      metrics.verificationScore * 0.25 +
      metrics.additionalityScore * 0.2 +
      metrics.permanenceScore * 0.15 +
      metrics.leakageScore * 0.1 +
      metrics.cobenefitsScore * 0.2 +
      metrics.transparencyScore * 0.1;

    return Math.round(score);
  }

  async updateDynamicScore(id: string) {
    const metrics = await this.getQualityMetrics(id);
    if (!metrics) return;

    const dynamicScore = this.calculateDynamicScore({
      verificationScore: metrics.verificationScore || 0,
      additionalityScore: metrics.additionalityScore || 0,
      permanenceScore: metrics.permanenceScore || 0,
      leakageScore: metrics.leakageScore || 0,
      cobenefitsScore: metrics.cobenefitsScore || 0,
      transparencyScore: metrics.transparencyScore || 0,
    });

    await this.prisma.credit.update({
      where: { id },
      data: { dynamicScore },
    });

    return dynamicScore;
  }
}
