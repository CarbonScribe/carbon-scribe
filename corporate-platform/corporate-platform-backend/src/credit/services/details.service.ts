import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class DetailsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const credit = await this.prisma.credit.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!credit) {
      throw new NotFoundException(`Credit with ID ${id} not found`);
    }

    return credit;
  }

  async getStats() {
    const stats = await this.prisma.credit.aggregate({
      _sum: {
        availableAmount: true,
      },
      _avg: {
        pricePerTon: true,
      },
      _count: {
        id: true,
      },
      where: {
        status: 'available',
      },
    });

    const methodologyCounts = await this.prisma.credit.groupBy({
      by: ['methodology'],
      _count: {
        id: true,
      },
    });

    return {
      totalAvailable: stats._sum.availableAmount || 0,
      averagePrice: stats._avg.pricePerTon || 0,
      projectCount: stats._count.id || 0,
      methodologyBreakdown: methodologyCounts.reduce((acc, curr) => {
        acc[curr.methodology] = curr._count.id;
        return acc;
      }, {}),
    };
  }
}
