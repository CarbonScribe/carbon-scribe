import { Injectable } from '@nestjs/common';
import {
  IProgressMetrics,
  IYearlyProgressPoint,
} from '../interfaces/progress-metrics.interface';

@Injectable()
export class ProgressTrackingService {
  /**
   * Calculates expected (target) emissions for a given reporting year using
   * linear interpolation along the reduction pathway from base year to target year.
   */
  calculateTargetEmissions(
    baseYearEmissions: number,
    reductionPercentage: number,
    baseYear: number,
    targetYear: number,
    reportingYear: number,
  ): number {
    const totalYears = targetYear - baseYear;
    if (totalYears <= 0) return baseYearEmissions;

    const elapsed = Math.min(reportingYear - baseYear, totalYears);
    const reductionFraction = (reductionPercentage / 100) * (elapsed / totalYears);
    const targetEmissions = baseYearEmissions * (1 - reductionFraction);
    return Math.max(0, Math.round(targetEmissions * 100) / 100);
  }

  /**
   * Determines whether actual emissions are on track (within a 5% tolerance
   * above the linear pathway target).
   */
  isOnTrack(actualEmissions: number, targetEmissions: number): boolean {
    if (targetEmissions <= 0) return actualEmissions <= 0;
    const ratio = actualEmissions / targetEmissions;
    return ratio <= 1.05;
  }

  /**
   * Calculates variance as percentage above/below the target pathway.
   * Positive value = over target (bad), negative = below target (good).
   */
  calculateVariance(actualEmissions: number, targetEmissions: number): number {
    if (targetEmissions <= 0) return 0;
    const variance = ((actualEmissions - targetEmissions) / targetEmissions) * 100;
    return Math.round(variance * 100) / 100;
  }

  /**
   * Builds a full metrics object for a target, including a year-by-year breakdown
   * of the target pathway and any recorded actual emissions.
   */
  buildProgressMetrics(params: {
    targetId: string;
    targetType: string;
    scope: string;
    baseYear: number;
    baseYearEmissions: number;
    targetYear: number;
    reductionPercentage: number;
    progressRecords: { reportingYear: number; emissions: number }[];
  }): IProgressMetrics {
    const {
      targetId,
      targetType,
      scope,
      baseYear,
      baseYearEmissions,
      targetYear,
      reductionPercentage,
      progressRecords,
    } = params;

    const currentYear = new Date().getFullYear();
    const totalYears = targetYear - baseYear;
    const requiredAnnualReductionRate =
      totalYears > 0 ? reductionPercentage / totalYears : 0;

    const actualByYear = new Map(
      progressRecords.map((r) => [r.reportingYear, r.emissions]),
    );

    const yearlyBreakdown: IYearlyProgressPoint[] = [];
    for (let y = baseYear; y <= targetYear; y++) {
      const targetEmissions = this.calculateTargetEmissions(
        baseYearEmissions,
        reductionPercentage,
        baseYear,
        targetYear,
        y,
      );
      const actualEmissions = actualByYear.get(y);
      yearlyBreakdown.push({
        year: y,
        targetEmissions,
        actualEmissions,
        onTrack:
          actualEmissions !== undefined
            ? this.isOnTrack(actualEmissions, targetEmissions)
            : undefined,
      });
    }

    const latestRecord = progressRecords
      .filter((r) => r.reportingYear <= currentYear)
      .sort((a, b) => b.reportingYear - a.reportingYear)[0];

    const currentEmissions = latestRecord?.emissions ?? 0;
    const currentTargetEmissions = this.calculateTargetEmissions(
      baseYearEmissions,
      reductionPercentage,
      baseYear,
      targetYear,
      latestRecord?.reportingYear ?? currentYear,
    );

    const actualReductionToDate =
      baseYearEmissions > 0
        ? ((baseYearEmissions - currentEmissions) / baseYearEmissions) * 100
        : 0;

    const expectedReductionToDate =
      baseYearEmissions > 0
        ? ((baseYearEmissions - currentTargetEmissions) / baseYearEmissions) * 100
        : 0;

    const progressPercentage =
      expectedReductionToDate > 0
        ? Math.min(
            100,
            Math.round((actualReductionToDate / reductionPercentage) * 100),
          )
        : 0;

    return {
      targetId,
      targetType,
      scope,
      baseYear,
      baseYearEmissions,
      targetYear,
      reductionPercentage,
      currentYear,
      currentEmissions,
      targetEmissionsForCurrentYear: currentTargetEmissions,
      requiredAnnualReductionRate: Math.round(requiredAnnualReductionRate * 100) / 100,
      actualReductionToDate: Math.round(actualReductionToDate * 100) / 100,
      onTrack: this.isOnTrack(currentEmissions, currentTargetEmissions),
      progressPercentage,
      yearlyBreakdown,
    };
  }
}
