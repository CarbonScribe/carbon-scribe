import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { Credit } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSimilarCredits(creditId: string, limit = 20): Promise<Credit[]> {
    const credit = await this.prisma.credit.findUnique({
      where: { id: creditId },
    });
    if (!credit) {
      throw new NotFoundException('Credit not found');
    }

    const where: any = {
      id: { not: creditId },
      available: { gt: 0 },
    };

    const or: any[] = [];
    if (credit.country) {
      or.push({ country: credit.country });
    }
    if (credit.methodology) {
      or.push({ methodology: credit.methodology });
    }
    if (credit.vintageYear != null) {
      or.push({ vintageYear: credit.vintageYear });
    }
    if (credit.sdgs) {
      const parts = credit.sdgs.split(',').map((p) => p.trim());
      for (const token of parts) {
        or.push({
          sdgs: {
            contains: token,
          },
        });
      }
    }

    if (or.length > 0) {
      where.OR = or;
    }

    return this.prisma.credit.findMany({
      where: where as any,
      orderBy: [{ viewCount: 'desc' }, { purchaseCount: 'desc' }] as any,
      take: limit,
    });
  }
}
