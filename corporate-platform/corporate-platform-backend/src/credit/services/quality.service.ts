import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreditQualityBreakdown } from '../interfaces/credit-quality.interface';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getQualityBreakdown(
    id: string,
    companyId?: string,
  ): Promise<CreditQualityBreakdown> {
    const where: any = { id };
    if (companyId) where.companyId = companyId;
    const credit = await this.prisma.credit.findFirst({ where });
    if (!credit)
      return {
        dynamicScore: 0,
        verificationScore: 0,
        additionalityScore: 0,
        permanenceScore: 0,
        leakageScore: 0,
        cobenefitsScore: 0,
        transparencyScore: 0,
      };

    const verificationScore = credit.verificationScore ?? 0;
    const additionalityScore = credit.additionalityScore ?? 0;
    const permanenceScore = credit.permanenceScore ?? 0;
    const leakageScore = credit.leakageScore ?? 0;
    const cobenefitsScore = credit.cobenefitsScore ?? 0;
    const transparencyScore = credit.transparencyScore ?? 0;

    // simple composite: weighted average
    const dynamicScore = Math.round(
      verificationScore * 0.25 +
        additionalityScore * 0.2 +
        permanenceScore * 0.2 +
        (100 - leakageScore) * 0.15 +
        cobenefitsScore * 0.1 +
        transparencyScore * 0.1,
    );

    return {
      dynamicScore,
      verificationScore,
      additionalityScore,
      permanenceScore,
      leakageScore,
      cobenefitsScore,
      transparencyScore,
    };
  }
}
