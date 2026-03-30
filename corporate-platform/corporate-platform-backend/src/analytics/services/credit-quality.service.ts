import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';
import {
  QualityRadarData,
  PortfolioQualityScore,
  IndustryBenchmark,
} from '../interfaces/credit-quality.interface';

@Injectable()
export class CreditQualityService {
  private logger = new Logger('CreditQualityService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Get credit quality radar chart data
   */
  async getRadarData(projectId: string): Promise<QualityRadarData> {
    const cacheKey = `quality:radar:${projectId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { credits: true },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const credits = project.credits;
    const dimensionDefs: Array<
      | 'permanence'
      | 'additionality'
      | 'verification'
      | 'leakage'
      | 'cobenefits'
      | 'transparency'
    > = [
      'permanence',
      'additionality',
      'verification',
      'leakage',
      'cobenefits',
      'transparency',
    ];

    const dimensions = dimensionDefs.map((name) => ({
      name,
      score: this.calculateScore(credits, `${name}Score` as any),
    }));

    const overallScore =
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;

    const radarData: QualityRadarData = {
      projectId,
      projectName: project.name,
      overallScore,
      dimensions: dimensions.map((d) => ({
        name: d.name,
        score: d.score,
        weight: 1 / dimensions.length,
        description: `${d.name} score for quality assessment`,
      })),
      riskFactors: this.identifyRiskFactors(credits),
      benchmarkComparison: await this.getBenchmarkComparison(project),
      lastUpdated: new Date(),
    };

    await this.cache.set(cacheKey, JSON.stringify(radarData), 3600);
    return radarData;
  }

  /**
   * Get portfolio-wide quality scores
   */
  async getPortfolioQuality(
    companyId: string,
  ): Promise<PortfolioQualityScore[]> {
    const cacheKey = `quality:portfolio:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const portfolios = await this.prisma.portfolio.findMany({
      where: { companyId },
      include: { holdings: { include: { credit: true } } },
    });

    const scores = portfolios.map((portfolio) => {
      const credits = portfolio.holdings.map((h) => h.credit);
      const compositScore =
        credits.reduce((sum, c) => sum + c.dynamicScore, 0) / credits.length;

      return {
        portfolioId: portfolio.id,
        companyId: portfolio.companyId,
        compositScore,
        scoresByDimension: {
          verification: this.calculateScore(credits, 'verificationScore'),
          permanence: this.calculateScore(credits, 'permanenceScore'),
          additionality: this.calculateScore(credits, 'additionalityScore'),
        },
        topRisks: [],
        projectCount: credits.length,
        qualityDistribution: {
          excellent: credits.filter((c) => c.dynamicScore >= 80).length,
          good: credits.filter(
            (c) => c.dynamicScore >= 60 && c.dynamicScore < 80,
          ).length,
          fair: credits.filter(
            (c) => c.dynamicScore >= 40 && c.dynamicScore < 60,
          ).length,
          poor: credits.filter((c) => c.dynamicScore < 40).length,
        },
      };
    });

    await this.cache.set(cacheKey, JSON.stringify(scores), 3600);
    return scores;
  }

  /**
   * Get industry benchmarks
   */
  async getBenchmarks(
    industry?: string,
    region?: string,
  ): Promise<IndustryBenchmark> {
    const cacheKey = `quality:benchmark:${industry}:${region || 'global'}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const credits = await this.prisma.credit.findMany({
      where: {
        ...(industry && { methodology: industry }),
        ...(region && { country: region }),
      },
    });

    const scores = credits.map((c) => c.dynamicScore).sort((a, b) => a - b);
    const benchmark: IndustryBenchmark = {
      industry: industry || 'All',
      region: region || 'Global',
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length || 0,
      medianScore: scores[Math.floor(scores.length / 2)] || 0,
      percentile: {
        p10: scores[Math.floor(scores.length * 0.1)] || 0,
        p25: scores[Math.floor(scores.length * 0.25)] || 0,
        p50: scores[Math.floor(scores.length * 0.5)] || 0,
        p75: scores[Math.floor(scores.length * 0.75)] || 0,
        p90: scores[Math.floor(scores.length * 0.9)] || 0,
      },
      trendData: [],
    };

    await this.cache.set(cacheKey, JSON.stringify(benchmark), 86400);
    return benchmark;
  }

  private calculateScore(credits: any[], scoreField: string): number {
    if (credits.length === 0) return 0;
    const scores = credits
      .filter((c) => c[scoreField] > 0)
      .map((c) => c[scoreField]);
    return scores.length > 0
      ? scores.reduce((a, b) => a + b) / scores.length
      : 0;
  }

  private identifyRiskFactors(credits: any[]) {
    const risks = [];

    const avgScore = this.calculateScore(credits, 'dynamicScore');
    if (avgScore < 50) {
      risks.push({
        name: 'Low Quality Score',
        severity: 'high',
        description: 'Average quality score below 50',
        mitigation: 'Conduct additional verification',
      });
    }

    return risks;
  }

  private async getBenchmarkComparison(project: any) {
    const allScores = (
      await this.prisma.credit.findMany({
        where: { project: { type: project.type } },
      })
    ).map((c) => c.dynamicScore);

    const projectAvgScore =
      (project.credits || []).reduce(
        (sum: number, c: any) => sum + c.dynamicScore,
        0,
      ) / (project.credits?.length || 1);

    return {
      projectScore: projectAvgScore,
      industryAverage:
        allScores.reduce((a, b) => a + b, 0) / allScores.length || 0,
      regionAverage: 70, // Placeholder
      percentile: this.analytics.calculatePercentileRank(
        projectAvgScore,
        allScores,
      ),
      trend: 'stable' as const,
    };
  }
}
