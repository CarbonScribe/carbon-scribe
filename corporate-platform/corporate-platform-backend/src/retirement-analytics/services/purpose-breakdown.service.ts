import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  PurposeBreakdownItem,
  PurposeBreakdownResponse,
} from '../interfaces/purpose-breakdown.interface';

const PURPOSE_COLORS: Record<string, string> = {
  SCOPE_1: '#4CAF50',
  SCOPE_2: '#2196F3',
  SCOPE_3: '#FF9800',
  CORPORATE: '#9C27B0',
  EVENTS: '#F44336',
  PRODUCT: '#00BCD4',
};

const PURPOSE_LABELS: Record<string, string> = {
  SCOPE_1: 'Scope 1',
  SCOPE_2: 'Scope 2',
  SCOPE_3: 'Scope 3',
  CORPORATE: 'Corporate',
  EVENTS: 'Events',
  PRODUCT: 'Product',
};

@Injectable()
export class PurposeBreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  async getBreakdown(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PurposeBreakdownResponse> {
    const where: any = { companyId };

    if (startDate || endDate) {
      where.retiredAt = {};
      if (startDate) where.retiredAt.gte = startDate;
      if (endDate) where.retiredAt.lte = endDate;
    }

    const grouped = await this.prisma.retirement.groupBy({
      by: ['purpose'],
      where,
      _sum: { amount: true },
    });

    const totalRetired = grouped.reduce(
      (sum, g) => sum + (g._sum.amount || 0),
      0,
    );

    const purposes: PurposeBreakdownItem[] = grouped.map((g) => ({
      name: PURPOSE_LABELS[g.purpose] || g.purpose,
      amount: g._sum.amount || 0,
      percentage:
        totalRetired > 0
          ? Math.round(((g._sum.amount || 0) / totalRetired) * 10000) / 100
          : 0,
      color: PURPOSE_COLORS[g.purpose] || '#757575',
    }));

    // Normalize percentages to ensure they total exactly 100%
    if (purposes.length > 0 && totalRetired > 0) {
      const percentageSum = purposes.reduce((s, p) => s + p.percentage, 0);
      if (percentageSum !== 100) {
        const diff = 100 - percentageSum;
        // Add the rounding difference to the largest category
        const largestIdx = purposes.reduce(
          (maxIdx, p, i, arr) => (p.amount > arr[maxIdx].amount ? i : maxIdx),
          0,
        );
        purposes[largestIdx].percentage =
          Math.round((purposes[largestIdx].percentage + diff) * 100) / 100;
      }
    }

    return {
      purposes,
      totalRetired,
      periodStart: startDate?.toISOString() || '',
      periodEnd: endDate?.toISOString() || '',
    };
  }
}
