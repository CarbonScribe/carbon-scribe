import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { RetirementQueryDto } from '../dto/retirement-query.dto';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async getHistory(query: RetirementQueryDto) {
    const {
      startDate,
      endDate,
      purpose,
      creditProject,
      page = 1,
      limit = 10,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (startDate || endDate) {
      where.retiredAt = {};
      if (startDate) where.retiredAt.gte = new Date(startDate);
      if (endDate) where.retiredAt.lte = new Date(endDate);
    }
    if (purpose) where.purpose = purpose;
    if (creditProject) {
      where.credit = {
        projectName: { contains: creditProject, mode: 'insensitive' },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.retirement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { retiredAt: 'desc' },
        include: { credit: true },
      }),
      this.prisma.retirement.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getStats(companyId: string) {
    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
    });

    const totalRetired = retirements.reduce((sum, r) => sum + r.amount, 0);

    const byPurpose = retirements.reduce(
      (acc, r) => {
        acc[r.purpose] = (acc[r.purpose] || 0) + r.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Simple monthly trend (last 6 months)
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleString('default', { month: 'short' });
      const amount = retirements
        .filter(
          (r) =>
            r.retiredAt.getMonth() === d.getMonth() &&
            r.retiredAt.getFullYear() === d.getFullYear(),
        )
        .reduce((sum, r) => sum + r.amount, 0);
      return { month: monthStr, amount };
    }).reverse();

    return { totalRetired, byPurpose, monthlyTrend };
  }

  async exportCsv(companyId: string) {
    const data = await this.prisma.retirement.findMany({
      where: { companyId },
      include: { credit: true },
    });

    const rows = data.map((r) => ({
      ID: r.id,
      Date: r.retiredAt.toISOString(),
      Project: r.credit.projectName,
      Amount: r.amount,
      Purpose: r.purpose,
      PurposeDetails: r.purposeDetails || 'N/A',
      Price: r.priceAtRetirement,
      Transaction: r.transactionHash || 'N/A',
    }));

    return stringify(rows, { header: true });
  }
}
