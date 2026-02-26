import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { OrderQueryDto } from '../dto/order-query.dto';
import { IPaginatedOrders } from '../interfaces/order.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders(
    companyId: string,
    query: OrderQueryDto,
  ): Promise<IPaginatedOrders> {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy,
      sortOrder,
      search,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { companyId };

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

    const orderBy: Prisma.OrderOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: data as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
