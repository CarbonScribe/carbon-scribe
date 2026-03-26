import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ComparisonResult } from '../interfaces/credit-comparison.interface';

@Injectable()
export class ComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(
    projectIds: string[],
    companyId?: string,
  ): Promise<ComparisonResult> {
    const where: any = { projectId: { in: projectIds } };
    if (companyId) where.companyId = companyId;
    const credits = await this.prisma.credit.findMany({
      where,
      include: { project: true },
    });

    const points = credits.map((c) => ({
      projectId: c.projectId,
      projectName: c.projectName,
      pricePerTon: c.pricePerTon ?? 0,
      dynamicScore: c.dynamicScore ?? 0,
      country: c.country,
      methodology: c.methodology,
      vintage: c.vintage,
    }));

    const avgPrice = points.length
      ? points.reduce((s, p) => s + p.pricePerTon, 0) / points.length
      : 0;
    const avgScore = points.length
      ? points.reduce((s, p) => s + p.dynamicScore, 0) / points.length
      : 0;

    return { points, avgPrice, avgScore };
  }
}
