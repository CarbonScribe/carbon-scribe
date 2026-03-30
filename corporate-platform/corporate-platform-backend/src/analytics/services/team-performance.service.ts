import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class TeamPerformanceService {
  private logger = new Logger('TeamPerformanceService');

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Get team/project developer performance metrics
   */
  async getTeamPerformance(companyId: string) {
    const cacheKey = `team:performance:${companyId}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: { credits: true },
    });

    const developerMap = new Map();

    projects.forEach((project) => {
      const developer = project.developer || 'Unknown';

      if (!developerMap.has(developer)) {
        developerMap.set(developer, {
          developerId: developer,
          projectCount: 0,
          totalCredits: 0,
          avgQualityScore: 0,
          portfolioValue: 0,
        });
      }

      const devData = developerMap.get(developer);
      devData.projectCount++;
      devData.totalCredits += project.availableCredits;
      devData.portfolioValue +=
        (project.availableCredits * (project.avgScore || 0)) / 100;
      devData.avgQualityScore =
        (devData.avgQualityScore + (project.avgScore || 0)) /
        devData.projectCount;
    });

    const result = Array.from(developerMap.values());
    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get developer performance rankings
   */
  async getTeamRankings(companyId: string, metric: string = 'quality') {
    const cacheKey = `team:rankings:${companyId}:${metric}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const teamPerf = await this.getTeamPerformance(companyId);

    const rankings = teamPerf.map((dev: any) => ({
      developerId: dev.developerId,
      score:
        metric === 'quality'
          ? dev.avgQualityScore
          : metric === 'volume'
            ? dev.totalCredits
            : dev.portfolioValue,
    }));

    rankings.sort((a: any, b: any) => b.score - a.score);

    const result = rankings.map((rank: any, idx: number) => ({
      ...rank,
      rank: idx + 1,
    }));

    await this.cache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * Get team portfolio analytics
   */
  async getTeamPortfolio(companyId: string, developerId?: string) {
    const cacheKey = `team:portfolio:${companyId}:${developerId || 'all'}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const projects = await this.prisma.project.findMany({
      where: {
        companyId,
        ...(developerId && { developer: developerId }),
      },
      include: { credits: true },
    });

    const portfolio = {
      developerCount: developerId
        ? 1
        : new Set(projects.map((p) => p.developer)).size,
      projectCount: projects.length,
      totalCredits: projects.reduce((sum, p) => sum + p.totalCredits, 0),
      availableCredits: projects.reduce(
        (sum, p) => sum + p.availableCredits,
        0,
      ),
      avgQualityScore:
        projects.length > 0
          ? projects.reduce((sum, p) => sum + (p.avgScore || 0), 0) /
            projects.length
          : 0,
      projects: projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        status: p.status,
        qualityScore: p.avgScore,
        credits: p.availableCredits,
      })),
    };

    await this.cache.set(cacheKey, JSON.stringify(portfolio), 3600);
    return portfolio;
  }
}
