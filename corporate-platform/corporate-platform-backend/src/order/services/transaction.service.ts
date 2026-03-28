import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import {
  TransactionListResult,
  TransactionRecord,
} from '../interfaces/transaction.interface';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async getTransactions(
    companyId: string,
    query: TransactionQueryDto,
  ): Promise<TransactionListResult> {
    const { type, startDate, endDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const prisma = this.prisma as any;

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: data.map((t: any) => this.toTransactionRecord(t)),
      total,
      page,
      limit,
    };
  }

  async getTransactionById(
    companyId: string,
    transactionId: string,
  ): Promise<TransactionRecord> {
    const prisma = this.prisma as any;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.companyId !== companyId) {
      throw new NotFoundException('Transaction not found');
    }

    return this.toTransactionRecord(transaction);
  }

  async exportCsv(companyId: string): Promise<string> {
    const prisma = this.prisma as any;

    const transactions = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const rows = transactions.map((t: any) => ({
      ID: t.id,
      Type: t.type,
      Amount: t.amount,
      Currency: t.currency,
      Status: t.status,
      OrderID: t.orderId || 'N/A',
      Date: t.createdAt.toISOString(),
    }));

    // Explicitly define columns so the header row is always emitted
    return stringify(rows, {
      header: true,
      columns: [
        'ID',
        'Type',
        'Amount',
        'Currency',
        'Status',
        'OrderID',
        'Date',
      ],
    });
  }

  private toTransactionRecord(t: any): TransactionRecord {
    return {
      id: t.id,
      companyId: t.companyId,
      userId: t.userId ?? undefined,
      type: t.type,
      orderId: t.orderId ?? undefined,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      metadata: t.metadata ?? undefined,
      createdAt: t.createdAt,
    };
  }
}
