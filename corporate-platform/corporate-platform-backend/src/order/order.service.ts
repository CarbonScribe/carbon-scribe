import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { IOrder, IOrderStats } from './interfaces/order.interface';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, companyId: string): Promise<IOrder> {
    const order = await this.prisma.order.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        statusEvents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    return order as unknown as IOrder;
  }

  async getStats(companyId: string): Promise<IOrderStats> {
    const [totalResult, statusCounts] = await Promise.all([
      this.prisma.order.aggregate({
        where: { companyId },
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
    ]);

    const completedCount =
      statusCounts.find((s) => s.status === OrderStatus.COMPLETED)?._count
        ?.id ?? 0;
    const pendingCount =
      statusCounts.find((s) => s.status === OrderStatus.PENDING)?._count?.id ??
      0;

    return {
      totalSpent: totalResult._sum.total ?? 0,
      orderCount: totalResult._count.id,
      avgOrderValue: totalResult._avg.total ?? 0,
      completedOrders: completedCount,
      pendingOrders: pendingCount,
    };
  }
}
