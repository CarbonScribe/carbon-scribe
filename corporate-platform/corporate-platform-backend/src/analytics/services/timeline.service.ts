import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class TimelineService {
  private logger = new Logger('TimelineService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Get cumulative carbon reduction timeline
   */
  async getCarbonReductionTimeline(companyId: string, months: number = 60) {
    const cacheKey = `timeline:carbon:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'asc' },
    });

    const timeline = [];
    let cumulative = 0;
    const now = new Date();

    for (let i = months; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthRetirements = retirements.filter(
        (r) =>
          new Date(r.retiredAt) >= monthStart &&
          new Date(r.retiredAt) <= monthEnd,
      );

      const monthlyAmount = monthRetirements.reduce(
        (sum, r) => sum + r.amount,
        0,
      );
      cumulative += monthlyAmount;

      timeline.push({
        date: monthStart,
        monthlyReduction: monthlyAmount,
        cumulativeReduction: cumulative,
        trend: monthlyAmount > 0 ? 'up' : 'stable',
      });
    }

    const result = {
      data: timeline,
      currentTotal: cumulative,
      monthlyAverage: cumulative / months,
      accelerationFactor: this.calculateAcceleration(timeline),
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get future reduction scenarios
   */
  async getReductionProjections(companyId: string, months: number = 36) {
    const cacheKey = `timeline:projections:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const historicalData = await this.getHistoricalReductions(companyId, 24);
    const baseline =
      historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d, 0) / historicalData.length
        : 0;

    const scenarios = {
      optimistic: this.generateProjection(baseline * 1.3, months),
      realistic: this.generateProjection(baseline, months),
      pessimistic: this.generateProjection(baseline * 0.7, months),
    };

    const result = {
      scenarios,
      baselineMonthly: baseline,
      currentTrend: 'increasing',
      recommendedTarget: baseline * 1.2,
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get key achievement dates and milestones
   */
  async getMilestones(companyId: string) {
    const cacheKey = `timeline:milestones:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'asc' },
    });

    let cumulative = 0;
    const milestones = [];

    const targets = [
      { value: 1000, label: '1,000 Credits' },
      { value: 5000, label: '5,000 Credits' },
      { value: 10000, label: '10,000 Credits' },
      { value: 50000, label: '50,000 Credits' },
      { value: 100000, label: '100,000 Credits' },
    ];

    targets.forEach((target) => {
      const milestone = retirements.find((r) => {
        cumulative += r.amount;
        return cumulative >= target.value;
      });

      if (milestone) {
        milestones.push({
          date: milestone.retiredAt,
          value: target.value,
          label: target.label,
          achieved: true,
        });
      }
    });

    // Add net zero target if set
    if (company.netZeroTargetYear) {
      milestones.push({
        date: new Date(company.netZeroTargetYear, 0, 1),
        value: company.netZeroTarget,
        label: 'Net Zero Target',
        achieved: false,
      });
    }

    // Add annual retirement target milestones
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const year = now.getFullYear() + i;
      milestones.push({
        date: new Date(year, 0, 1),
        value: company.annualRetirementTarget * (i + 1),
        label: `Annual Target Year ${i + 1}`,
        achieved: i === 0,
      });
    }

    const result = {
      milestones: milestones.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      ),
      netZeroTarget: company.netZeroTarget,
      netZeroYear: company.netZeroTargetYear,
      parisAgreementCompliant: this.checkParisCompliance(company),
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 86400);
    return result;
  }

  private async getHistoricalReductions(
    companyId: string,
    months: number,
  ): Promise<number[]> {
    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'asc' },
    });

    const data: number[] = [];
    const now = new Date();

    for (let i = months; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthRetirements = retirements.filter(
        (r) =>
          new Date(r.retiredAt) >= monthStart &&
          new Date(r.retiredAt) <= monthEnd,
      );

      const total = monthRetirements.reduce((sum, r) => sum + r.amount, 0);
      data.push(total);
    }

    return data;
  }

  private generateProjection(baselineMonthly: number, months: number) {
    const projection = [];
    let cumulative = 0;

    for (let i = 1; i <= months; i++) {
      const monthlyValue =
        baselineMonthly + (Math.random() - 0.5) * baselineMonthly * 0.2;
      cumulative += monthlyValue;

      projection.push({
        date: new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000),
        monthlyProjection: Math.max(0, monthlyValue),
        cumulativeProjection: Math.max(0, cumulative),
      });
    }

    return projection;
  }

  private calculateAcceleration(timeline: any[]): number {
    if (timeline.length < 2) return 0;

    const firstHalf = timeline.slice(0, Math.floor(timeline.length / 2));
    const secondHalf = timeline.slice(Math.floor(timeline.length / 2));

    const firstHalfAvg =
      firstHalf.reduce((sum, t) => sum + t.monthlyReduction, 0) /
      firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, t) => sum + t.monthlyReduction, 0) /
      secondHalf.length;

    return firstHalfAvg > 0 ? (secondHalfAvg - firstHalfAvg) / firstHalfAvg : 0;
  }

  private checkParisCompliance(company: any): boolean {
    if (!company.netZeroTargetYear) return false;

    const yearsToTarget = company.netZeroTargetYear - new Date().getFullYear();
    const parisDeadline = 2050;

    return company.netZeroTargetYear <= parisDeadline && yearsToTarget > 0;
  }
}
