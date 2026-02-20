import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import {
    ITransaction,
    IPaginatedTransactions,
} from '../interfaces/transaction.interface';

@Injectable()
export class TransactionService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(
        companyId: string,
        query: TransactionQueryDto,
    ): Promise<IPaginatedTransactions> {
        const {
            page = 1,
            limit = 10,
            type,
            startDate,
            endDate,
        } = query;

        const where: any = { companyId };

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

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
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

    async findById(
        id: string,
        companyId: string,
    ): Promise<ITransaction | null> {
        const transaction = await this.prisma.transaction.findFirst({
            where: { id, companyId },
        });

        return transaction as unknown as ITransaction | null;
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
            'Order ID',
            'Retirement ID',
            'Created At',
        ];

        const rows = transactions.map((t) =>
            [
                t.id,
                t.type,
                t.amount.toString(),
                `"${t.description.replace(/"/g, '""')}"`,
                t.transactionHash ?? '',
                t.orderId ?? '',
                t.retirementId ?? '',
                t.createdAt.toISOString(),
            ].join(','),
        );

        return [headers.join(','), ...rows].join('\n');
    }
}
