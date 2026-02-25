import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ComparisonService {
  constructor(private prisma: PrismaService) {}

  async compareProjects(projectIds: string[]) {
    const credits = await this.prisma.credit.findMany({
      where: {
        projectId: { in: projectIds },
      },
      include: {
        project: true,
      },
    });

    // Generate scatter plot data: Price vs Quality
    const performanceData = credits.map((c) => ({
      name: c.projectName,
      price: c.pricePerTon,
      qualityScore: c.dynamicScore,
      country: c.country,
      methodology: c.methodology,
    }));

    // Benchmarking by methodology
    const methodologies = [...new Set(credits.map((c) => c.methodology))];
    const methodologyBenchmarks = await Promise.all(
      methodologies.map(async (m) => {
        const benchmarks = await this.prisma.credit.aggregate({
          where: { methodology: m },
          _avg: {
            pricePerTon: true,
            dynamicScore: true,
          },
        });
        return {
          methodology: m,
          avgPrice: benchmarks._avg.pricePerTon,
          avgScore: benchmarks._avg.dynamicScore,
        };
      }),
    );

    return {
      performanceData,
      methodologyBenchmarks,
    };
  }
}
