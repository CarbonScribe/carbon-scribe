import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  TrendPeriod,
  TrendDataResponse,
} from '../interfaces/trend-data.interface';

@Injectable()
export class TrendAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrends(
    companyId: string,
    aggregation: 'monthly' | 'quarterly' = 'monthly',
    startDate?: Date,
    endDate?: Date,
  ): Promise<TrendDataResponse> {
    const now = new Date();
    const effectiveEnd = endDate || now;
    const effectiveStart =
      startDate || new Date(now.getFullYear() - 1, now.getMonth(), 1);

    // Fetch retirements within the date range
    const retirements = await this.prisma.retirement.findMany({
      where: {
        companyId,
        retiredAt: {
          gte: effectiveStart,
          lte: effectiveEnd,
        },
      },
      orderBy: { retiredAt: 'asc' },
    });

    // Fetch previous year retirements for YoY comparison
    const prevYearStart = new Date(effectiveStart);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
    const prevYearEnd = new Date(effectiveEnd);
    prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

    const previousYearRetirements = await this.prisma.retirement.findMany({
      where: {
        companyId,
        retiredAt: {
          gte: prevYearStart,
          lte: prevYearEnd,
        },
      },
      orderBy: { retiredAt: 'asc' },
    });

    // Fetch targets for the same period
    const startYear = effectiveStart.getFullYear();
    const endYear = effectiveEnd.getFullYear();
    const targets = await this.prisma.retirementTarget.findMany({
      where: {
        companyId,
        year: { gte: startYear, lte: endYear },
      },
    });

    // Build target lookup
    const targetMap = new Map<string, number>();
    for (const t of targets) {
      const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
      targetMap.set(key, t.target);
    }

    // Build monthly buckets for current period
    const monthlyData = new Map<string, number>();
    const current = new Date(
      effectiveStart.getFullYear(),
      effectiveStart.getMonth(),
      1,
    );
    while (current <= effectiveEnd) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, 0);
      current.setMonth(current.getMonth() + 1);
    }

    // Aggregate retirements into monthly buckets
    for (const r of retirements) {
      const d = new Date(r.retiredAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, (monthlyData.get(key) || 0) + r.amount);
    }

    // Build previous year monthly lookup for YoY
    const prevYearMonthlyData = new Map<number, number>();
    for (const r of previousYearRetirements) {
      const d = new Date(r.retiredAt);
      const monthKey = d.getMonth(); // 0-11
      prevYearMonthlyData.set(
        monthKey,
        (prevYearMonthlyData.get(monthKey) || 0) + r.amount,
      );
    }

    let periods: TrendPeriod[];

    if (aggregation === 'quarterly') {
      periods = this.aggregateQuarterly(
        monthlyData,
        targetMap,
        prevYearMonthlyData,
      );
    } else {
      periods = this.aggregateMonthly(
        monthlyData,
        targetMap,
        prevYearMonthlyData,
      );
    }

    const totalRetired = periods.reduce((sum, p) => sum + p.retired, 0);
    const totalTarget = periods.reduce((sum, p) => sum + p.target, 0);

    // Calculate YoY change percentage
    const totalPrevYear = previousYearRetirements.reduce(
      (sum, r) => sum + r.amount,
      0,
    );
    const yearOverYearChange =
      totalPrevYear > 0
        ? Math.round(((totalRetired - totalPrevYear) / totalPrevYear) * 10000) /
          100
        : undefined;

    return {
      periods,
      aggregation,
      totalRetired,
      totalTarget,
      yearOverYearChange,
    };
  }

  private aggregateMonthly(
    monthlyData: Map<string, number>,
    targetMap: Map<string, number>,
    prevYearData: Map<number, number>,
  ): TrendPeriod[] {
    const periods: TrendPeriod[] = [];
    let cumulative = 0;

    for (const [month, retired] of monthlyData) {
      cumulative += retired;
      const monthNum = parseInt(month.split('-')[1], 10) - 1; // 0-indexed
      periods.push({
        month,
        retired,
        target: targetMap.get(month) || 0,
        cumulative,
        previousYearRetired: prevYearData.get(monthNum) || 0,
      });
    }

    return periods;
  }

  private aggregateQuarterly(
    monthlyData: Map<string, number>,
    targetMap: Map<string, number>,
    prevYearData: Map<number, number>,
  ): TrendPeriod[] {
    const quarterlyData = new Map<
      string,
      { retired: number; target: number; prevYear: number }
    >();

    for (const [month, retired] of monthlyData) {
      const [year, m] = month.split('-').map(Number);
      const quarter = Math.ceil(m / 3);
      const key = `${year}-Q${quarter}`;

      if (!quarterlyData.has(key)) {
        quarterlyData.set(key, { retired: 0, target: 0, prevYear: 0 });
      }
      const q = quarterlyData.get(key)!;
      q.retired += retired;
      q.target += targetMap.get(month) || 0;
      q.prevYear += prevYearData.get(m - 1) || 0;
    }

    const periods: TrendPeriod[] = [];
    let cumulative = 0;

    for (const [month, data] of quarterlyData) {
      cumulative += data.retired;
      periods.push({
        month,
        retired: data.retired,
        target: data.target,
        cumulative,
        previousYearRetired: data.prevYear,
      });
    }

    return periods;
  }
}
