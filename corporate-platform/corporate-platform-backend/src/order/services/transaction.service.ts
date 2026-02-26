import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import {
  IPaginatedTransactions,
  ITransaction,
} from '../interfaces/transaction.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: TransactionQueryDto,
  ): Promise<IPaginatedTransactions> {
    const { page = 1, limit = 10, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = { companyId };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: data as unknown as ITransaction[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, companyId: string): Promise<ITransaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, companyId },
      include: { order: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID "${id}" not found`);
    }

    return transaction as unknown as ITransaction;
  }

  async exportCsv(companyId: string): Promise<string> {
    const transactions = await this.prisma.transaction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'ID',
      'Type',
      'Amount',
      'Description',
      'Transaction Hash',
      'Date',
    ];
    const rows = transactions.map((t) => [
      t.id,
      t.type,
      t.amount.toString(),
      `"${t.description.replace(/"/g, '""')}"`,
      t.transactionHash || '',
      new Date(t.createdAt).toISOString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
