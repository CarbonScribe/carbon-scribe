import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  TimelineMetrics,
  TimelineAggregation,
  TimelineDataPoint,
} from '../interfaces/portfolio-timeline.interface';

@Injectable()
export class TimelineService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getTimelineMetrics(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TimelineMetrics> {
    // Get portfolio snapshots
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { companyId },
    });

    if (!portfolio) {
      return {
        portfolioGrowth: { monthly: [], quarterly: [], yearly: [] },
        retirementTrends: { monthly: [], quarterly: [], yearly: [] },
        valueOverTime: { monthly: [], quarterly: [], yearly: [] },
      };
    }

    // Get snapshots if they exist
    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: {
        portfolioId: portfolio.id,
        ...(startDate &&
          endDate && {
            snapshotDate: {
              gte: startDate,
              lte: endDate,
            },
          }),
      },
      orderBy: { snapshotDate: 'asc' },
    });

    // Get retirements for this period
    const retirements = await this.prisma.retirement.findMany({
      where: {
        companyId,
        ...(startDate &&
          endDate && {
            retiredAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
      },
      orderBy: { retiredAt: 'asc' },
    });

    // Get holdings for value calculations
    const holdings = await this.prisma.portfolioHolding.findMany({
      where: { portfolioId: portfolio.id },
      include: { credit: true },
    });

    return {
      portfolioGrowth: this.calculatePortfolioGrowth(snapshots || holdings),
      retirementTrends: this.calculateRetirementTrends(retirements),
      valueOverTime: this.calculateValueOverTime(snapshots || holdings),
    };
  }

  private calculatePortfolioGrowth(data: any[]): TimelineAggregation {
    const monthlyData = new Map<string, number>();
    const quarterlyData = new Map<string, number>();
    const yearlyData = new Map<string, number>();

    data.forEach((item) => {
      const date = new Date(item.snapshotDate || item.purchaseDate);
      const quantity = item.totalRetired || item.quantity || 0;

      // Monthly
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`;
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + quantity);

      // Quarterly
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const quarterKey = `${date.getFullYear()}-Q${quarter}`;
      quarterlyData.set(
        quarterKey,
        (quarterlyData.get(quarterKey) || 0) + quantity,
      );

      // Yearly
      const yearKey = `${date.getFullYear()}`;
      yearlyData.set(yearKey, (yearlyData.get(yearKey) || 0) + quantity);
    });

    return {
      monthly: this.mapToTimelinePoints(monthlyData),
      quarterly: this.mapToTimelinePoints(quarterlyData),
      yearly: this.mapToTimelinePoints(yearlyData),
    };
  }

  private calculateRetirementTrends(retirements: any[]): TimelineAggregation {
    const monthlyData = new Map<string, number>();
    const quarterlyData = new Map<string, number>();
    const yearlyData = new Map<string, number>();

    retirements.forEach((retirement) => {
      const date = new Date(retirement.retiredAt);
      const amount = retirement.amount;

      // Monthly
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`;
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + amount);

      // Quarterly
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const quarterKey = `${date.getFullYear()}-Q${quarter}`;
      quarterlyData.set(
        quarterKey,
        (quarterlyData.get(quarterKey) || 0) + amount,
      );

      // Yearly
      const yearKey = `${date.getFullYear()}`;
      yearlyData.set(yearKey, (yearlyData.get(yearKey) || 0) + amount);
    });

    return {
      monthly: this.mapToTimelinePoints(monthlyData),
      quarterly: this.mapToTimelinePoints(quarterlyData),
      yearly: this.mapToTimelinePoints(yearlyData),
    };
  }

  private calculateValueOverTime(data: any[]): TimelineAggregation {
    const monthlyData = new Map<string, number>();
    const quarterlyData = new Map<string, number>();
    const yearlyData = new Map<string, number>();

    data.forEach((item) => {
      const date = new Date(item.snapshotDate || item.purchaseDate);
      const value = item.totalValue || item.currentValue || 0;

      // Monthly
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`;
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + value);

      // Quarterly
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const quarterKey = `${date.getFullYear()}-Q${quarter}`;
      quarterlyData.set(
        quarterKey,
        (quarterlyData.get(quarterKey) || 0) + value,
      );

      // Yearly
      const yearKey = `${date.getFullYear()}`;
      yearlyData.set(yearKey, (yearlyData.get(yearKey) || 0) + value);
    });

    return {
      monthly: this.mapToTimelinePoints(monthlyData),
      quarterly: this.mapToTimelinePoints(quarterlyData),
      yearly: this.mapToTimelinePoints(yearlyData),
    };
  }

  private mapToTimelinePoints(
    dataMap: Map<string, number>,
  ): TimelineDataPoint[] {
    return Array.from(dataMap.entries())
      .map(([date, value]) => ({
        date,
        value: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
