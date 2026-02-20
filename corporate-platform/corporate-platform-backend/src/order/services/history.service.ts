import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { OrderQueryDto } from '../dto/order-query.dto';
import { IPaginatedOrders } from '../interfaces/order.interface';

@Injectable()
export class HistoryService {
    constructor(private readonly prisma: PrismaService) { }

    async getOrderHistory(
        companyId: string,
        query: OrderQueryDto,
    ): Promise<IPaginatedOrders> {
        const {
            page = 1,
            limit = 10,
            status,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search,
            startDate,
            endDate,
        } = query;

        const where: any = { companyId };

        if (status) {
            where.status = status;
        }

        if (search) {
            where.orderNumber = { contains: search, mode: 'insensitive' };
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
            this.prisma.order.findMany({
                where,
                include: { items: true },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit,
            }),
            this.prisma.order.count({ where }),
        ]);

        return {
            data: data as any[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
}
