import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  ForecastProjection,
  ForecastResponse,
} from '../interfaces/forecast.interface';

@Injectable()
export class ForecastingService {
  constructor(private readonly prisma: PrismaService) {}

  async getForecast(
    companyId: string,
    forecastMonths = 6,
  ): Promise<ForecastResponse> {
    // Fetch last 12 months of retirement data
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const retirements = await this.prisma.retirement.findMany({
      where: {
        companyId,
        retiredAt: { gte: twelveMonthsAgo },
      },
      orderBy: { retiredAt: 'asc' },
    });

    // Group into monthly totals
    const monthlyTotals = new Map<number, number>();
    for (const r of retirements) {
      const d = new Date(r.retiredAt);
      const monthIndex =
        (d.getFullYear() - twelveMonthsAgo.getFullYear()) * 12 +
        (d.getMonth() - twelveMonthsAgo.getMonth());
      monthlyTotals.set(
        monthIndex,
        (monthlyTotals.get(monthIndex) || 0) + r.amount,
      );
    }

    // Build data points for regression
    const dataPoints: { x: number; y: number }[] = [];
    const maxMonth =
      (now.getFullYear() - twelveMonthsAgo.getFullYear()) * 12 +
      (now.getMonth() - twelveMonthsAgo.getMonth());

    for (let i = 0; i <= maxMonth; i++) {
      dataPoints.push({
        x: i,
        y: monthlyTotals.get(i) || 0,
      });
    }

    // Perform linear regression
    const { slope, intercept, rSquared } = this.linearRegression(dataPoints);

    // Detect and apply seasonal adjustments
    const seasonalFactors = this.calculateSeasonalFactors(dataPoints);
    const hasSeasonalPattern = seasonalFactors.length > 0;

    // Calculate residual standard error for confidence intervals
    const residualStdError = this.calculateResidualStdError(
      dataPoints,
      slope,
      intercept,
    );

    // Generate projections
    const projections: ForecastProjection[] = [];
    for (let i = 1; i <= forecastMonths; i++) {
      const futureX = maxMonth + i;
      let predicted = Math.max(0, slope * futureX + intercept);

      // Apply seasonal adjustment if pattern detected
      if (hasSeasonalPattern) {
        const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthOfYear = futureDate.getMonth(); // 0-11
        predicted *= seasonalFactors[monthOfYear] || 1;
      }

      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const period = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

      // 95% confidence interval (approximately 1.96 standard deviations)
      const marginOfError = 1.96 * residualStdError;

      projections.push({
        period,
        predicted: Math.round(predicted * 100) / 100,
        confidence: {
          lower: Math.max(
            0,
            Math.round((predicted - marginOfError) * 100) / 100,
          ),
          upper: Math.round((predicted + marginOfError) * 100) / 100,
        },
      });
    }

    const seasonalNote = hasSeasonalPattern
      ? ' Seasonal adjustments applied based on detected monthly patterns.'
      : '';

    return {
      projections,
      methodology: `Linear regression model (y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}, R² = ${rSquared.toFixed(4)}) based on ${dataPoints.length} months of historical data with 95% confidence intervals.${seasonalNote}`,
      basedOnMonths: dataPoints.length,
    };
  }

  /**
   * Detect seasonal patterns by comparing each month's average to the overall average.
   * Returns an array of 12 seasonal factors (index 0 = January, etc.).
   * Returns empty array if no meaningful seasonal pattern is detected.
   */
  private calculateSeasonalFactors(
    dataPoints: { x: number; y: number }[],
  ): number[] {
    if (dataPoints.length < 6) return [];

    const overallMean =
      dataPoints.reduce((s, p) => s + p.y, 0) / dataPoints.length;
    if (overallMean === 0) return [];

    // Group data points by month-of-year (assume x=0 starts at the first month)
    const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);
    for (const p of dataPoints) {
      const monthOfYear = p.x % 12;
      monthBuckets[monthOfYear].push(p.y);
    }

    const factors: number[] = new Array(12).fill(1);
    let hasVariation = false;

    for (let m = 0; m < 12; m++) {
      if (monthBuckets[m].length > 0) {
        const monthMean =
          monthBuckets[m].reduce((s, v) => s + v, 0) / monthBuckets[m].length;
        factors[m] = monthMean / overallMean;
        if (Math.abs(factors[m] - 1) > 0.15) {
          hasVariation = true;
        }
      }
    }

    // Only return factors if meaningful seasonal variation (>15% deviation) detected
    return hasVariation ? factors : [];
  }

  private linearRegression(dataPoints: { x: number; y: number }[]): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = dataPoints.length;
    if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };

    const sumX = dataPoints.reduce((s, p) => s + p.x, 0);
    const sumY = dataPoints.reduce((s, p) => s + p.y, 0);
    const sumXY = dataPoints.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = dataPoints.reduce((s, p) => s + p.x * p.x, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0)
      return { slope: 0, intercept: sumY / n, rSquared: 0 };

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const meanY = sumY / n;
    const ssTotal = dataPoints.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const ssResidual = dataPoints.reduce(
      (s, p) => s + (p.y - (slope * p.x + intercept)) ** 2,
      0,
    );
    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

    return { slope, intercept, rSquared };
  }

  private calculateResidualStdError(
    dataPoints: { x: number; y: number }[],
    slope: number,
    intercept: number,
  ): number {
    if (dataPoints.length <= 2) return 0;

    const residuals = dataPoints.map((p) => p.y - (slope * p.x + intercept));
    const sumSquaredResiduals = residuals.reduce((s, r) => s + r * r, 0);

    return Math.sqrt(sumSquaredResiduals / (dataPoints.length - 2));
  }
}
