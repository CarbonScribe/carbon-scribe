import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class ProjectComparisonService {
  private logger = new Logger('ProjectComparisonService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Compare multiple projects
   */
  async compareProjects(projectIds: string[]) {
    const cacheKey = `comp:projects:${projectIds.join(',')}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      include: { credits: true },
    });

    const comparison = projects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      type: p.type,
      region: p.region,
      totalCredits: p.totalCredits,
      availableCredits: p.availableCredits,
      avgScore: p.avgScore,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      metrics: {
        creditValue: p.availableCredits,
        qualityScore: p.avgScore || 0,
        verificationRatio:
          p.credits.filter((c) => c.verificationScore > 70).length /
            p.credits.length || 0,
      },
    }));

    await this.cache.set(cacheKey, JSON.stringify(comparison), 3600);
    return comparison;
  }

  /**
   * Find similar projects for benchmarking
   */
  async findSimilarProjects(projectId: string, limit: number = 5) {
    const cacheKey = `comp:similar:${projectId}`;
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

    const allProjects = await this.prisma.project.findMany({
      where: {
        AND: [{ id: { not: projectId } }, { type: project.type }],
      },
      include: { credits: true },
    });

    const similarity = allProjects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      similarity: this.calculateSimilarity(project, p),
      metrics: {
        creditValue: p.availableCredits,
        qualityScore: p.avgScore || 0,
      },
    }));

    similarity.sort((a, b) => b.similarity - a.similarity);

    const result = similarity.slice(0, limit);
    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Identify top and bottom performing projects
   */
  async findOutliers(companyId: string, metric: string = 'quality') {
    const cacheKey = `comp:outliers:${companyId}:${metric}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const scores = projects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      score:
        metric === 'quality'
          ? p.avgScore || 0
          : metric === 'volume'
            ? p.totalCredits
            : p.availableCredits,
    }));

    scores.sort((a, b) => b.score - a.score);
    const topPerformers = scores.slice(0, Math.ceil(scores.length * 0.1));
    const bottomPerformers = scores.slice(Math.floor(scores.length * 0.9));

    const result = {
      topPerformers,
      bottomPerformers,
      metric,
      analysis: {
        topAverage:
          topPerformers.reduce((sum, p) => sum + p.score, 0) /
          topPerformers.length,
        bottomAverage:
          bottomPerformers.reduce((sum, p) => sum + p.score, 0) /
          bottomPerformers.length,
      },
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  private calculateSimilarity(project1: any, project2: any): number {
    let similarity = 0;

    // Type match
    if (project1.type === project2.type) similarity += 0.3;

    // Region match
    if (project1.region === project2.region) similarity += 0.3;

    // Similar size
    const sizeRatio =
      Math.min(project1.totalCredits, project2.totalCredits) /
      Math.max(project1.totalCredits, project2.totalCredits);
    similarity += sizeRatio * 0.2;

    // Similar quality
    const qualityDiff = Math.abs(
      (project1.avgScore || 0) - (project2.avgScore || 0),
    );
    similarity += Math.max(0, (100 - qualityDiff) / 100) * 0.2;

    return Math.min(similarity, 1);
  }
}
