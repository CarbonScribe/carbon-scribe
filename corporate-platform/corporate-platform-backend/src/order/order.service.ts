import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  IPaginatedOrders,
  IOrder,
  IOrderStats,
} from './interfaces/order.interface';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
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
      data: data as unknown as IOrder[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, companyId: string): Promise<IOrder | null> {
    const order = await this.prisma.order.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        statusEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    return order as unknown as IOrder | null;
  }

  async getStats(companyId: string): Promise<IOrderStats> {
    const result = await this.prisma.order.aggregate({
      where: { companyId, status: 'completed' },
      _sum: { total: true },
      _count: { id: true },
      _avg: { total: true },
    });

    return {
      totalSpent: result._sum.total ?? 0,
      orderCount: result._count.id,
      avgOrderValue: result._avg.total ?? 0,
    };
  }
}
