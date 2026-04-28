import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SorobanService } from '../soroban.service';
import { TransactionHistoryQueryDto } from '../dto/transaction-history.dto';

@Injectable()
export class TransactionHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sorobanService: SorobanService,
  ) {}

  async listCompanyTransactions(
    companyId: string,
    query: TransactionHistoryQueryDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (query.contractId) {
      where.contractId = query.contractId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.contractCall.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contractCall.count({ where }),
    ]);

    const enriched = await Promise.all(
      items.map(async (item) => {
        let onChain: unknown = null;
        try {
          if (!item.transactionHash.startsWith('sim_')) {
            onChain = await this.sorobanService.getTransaction(
              item.transactionHash,
            );
          }
        } catch {
          onChain = null;
        }

        return {
          ...item,
          onChain,
        };
      }),
    );

    return {
      page,
      limit,
      total,
      data: enriched,
    };
  }

  async getTransactionDetails(companyId: string, transactionHash: string) {
    const tx = await this.prisma.contractCall.findFirst({
      where: {
        companyId,
        transactionHash,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    let onChain: unknown = null;
    if (!tx.transactionHash.startsWith('sim_')) {
      try {
        onChain = await this.sorobanService.getTransaction(tx.transactionHash);
      } catch {
        onChain = null;
      }
    }

    return {
      ...tx,
      onChain,
    };
  }
}
