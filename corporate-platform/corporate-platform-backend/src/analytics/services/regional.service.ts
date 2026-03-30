import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class RegionalService {
  private logger = new Logger('RegionalService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Get performance by region/country
   */
  async getRegionalBreakdown(companyId: string) {
    const cacheKey = `regional:breakdown:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const regionMap = new Map();

    projects.forEach((project) => {
      const region = project.region || 'Unknown';

      if (!regionMap.has(region)) {
        regionMap.set(region, {
          region,
          projectCount: 0,
          totalCredits: 0,
          availableCredits: 0,
          avgQualityScore: 0,
          growthRate: 0,
          countryCode: project.country,
        });
      }

      const regionData = regionMap.get(region);
      regionData.projectCount++;
      regionData.totalCredits += project.totalCredits;
      regionData.availableCredits += project.availableCredits;
      regionData.avgQualityScore =
        (regionData.avgQualityScore + (project.avgScore || 0)) /
        regionData.projectCount;
    });

    const result = Array.from(regionMap.values());
    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get geographic concentration data (heatmap)
   */
  async getRegionalHeatmap(companyId: string) {
    const cacheKey = `regional:heatmap:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const heatmapData = [];
    const regionMap = new Map();

    projects.forEach((project) => {
      const key = `${project.country}-${project.region}`;

      if (!regionMap.has(key)) {
        regionMap.set(key, {
          country: project.country,
          region: project.region,
          concentration: 0,
          projectCount: 0,
          creditsPerProject: 0,
        });
      }

      const data = regionMap.get(key);
      data.projectCount++;
      data.creditsPerProject += project.availableCredits;
    });

    const totalCredits = projects.reduce(
      (sum, p) => sum + p.availableCredits,
      0,
    );

    for (const data of regionMap.values()) {
      data.concentration = (data.creditsPerProject / totalCredits) * 100;
      heatmapData.push(data);
    }

    const result = {
      data: heatmapData,
      giniCoefficient: this.calculateGiniCoefficient(
        heatmapData.map((d) => d.creditsPerProject),
      ),
      concentrationIndex:
        heatmapData.reduce((sum, d) => sum + d.concentration ** 2, 0) / 100,
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get regional performance trends
   */
  async getRegionalTrends(companyId: string, months: number = 12) {
    const cacheKey = `regional:trends:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      include: { credit: { include: { project: true } } },
    });

    const trendMap = new Map();
    const now = new Date();

    for (let i = months; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthRetirements = retirements.filter(
        (r) =>
          new Date(r.retiredAt) >= monthStart &&
          new Date(r.retiredAt) <= monthEnd,
      );

      monthRetirements.forEach((retirement) => {
        const region = retirement.credit?.project?.region || 'Unknown';
        const key = `${i}-${region}`;

        if (!trendMap.has(key)) {
          trendMap.set(key, {
            month: i,
            region,
            retirements: 0,
            volume: 0,
          });
        }

        const data = trendMap.get(key);
        data.retirements++;
        data.volume += retirement.amount;
      });
    }

    const result = Array.from(trendMap.values());
    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    let sum = 0;

    for (let i = 0; i < sorted.length; i++) {
      sum += (i + 1) * sorted[i];
    }

    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const gini =
      (2 * sum) / (sorted.length * sorted.length * mean) -
      (sorted.length + 1) / sorted.length;

    return Math.max(0, Math.min(1, gini));
  }
}
