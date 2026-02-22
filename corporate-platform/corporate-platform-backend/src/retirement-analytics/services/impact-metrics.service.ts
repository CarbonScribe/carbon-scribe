import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ImpactMetricsResponse } from '../interfaces/impact-metrics.interface';

// Industry-standard conversion constants
const CO2_PER_TREE_KG = 22; // 1 tree absorbs 22 kg CO₂ per year
const CO2_PER_CAR_TONNES = 4.6; // 1 car emits 4.6 tonnes CO₂ per year
const CO2_PER_HOME_TONNES = 7.5; // 1 home energy use = 7.5 tonnes CO₂ per year

@Injectable()
export class ImpactMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getImpactMetrics(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ImpactMetricsResponse> {
    const where: any = { companyId };

    if (startDate || endDate) {
      where.retiredAt = {};
      if (startDate) where.retiredAt.gte = startDate;
      if (endDate) where.retiredAt.lte = endDate;
    }

    const result = await this.prisma.retirement.aggregate({
      where,
      _sum: { amount: true },
    });

    const co2Offset = result._sum.amount || 0; // in tonnes

    return {
      co2Offset: Math.round(co2Offset * 100) / 100,
      treesPlanted: Math.round((co2Offset * 1000) / CO2_PER_TREE_KG),
      carsRemoved: Math.round((co2Offset / CO2_PER_CAR_TONNES) * 100) / 100,
      homesPowered: Math.round((co2Offset / CO2_PER_HOME_TONNES) * 100) / 100,
      calculationStandard: 'GHG Protocol Corporate Standard',
    };
  }
}
