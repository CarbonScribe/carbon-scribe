import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { OrderQueryDto } from '../dto/order-query.dto';
import {
  OrderDetail,
  OrderListResult,
  OrderStats,
} from '../interfaces/order.interface';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders(
    companyId: string,
    query: OrderQueryDto,
  ): Promise<OrderListResult> {
    const {
      status,
      startDate,
      endDate,
      orderNumber,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = { companyId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (orderNumber) {
      where.orderNumber = { contains: orderNumber, mode: 'insensitive' };
    }

    const orderBy: any = { [sortBy]: sortOrder };
    const prisma = this.prisma as any;

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          items: {
            include: { credit: { select: { projectName: true } } },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: data.map((order: any) => this.toOrderDetail(order)),
      total,
      page,
      limit,
    };
  }

  async getOrderById(companyId: string, orderId: string): Promise<OrderDetail> {
    const prisma = this.prisma as any;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { credit: true },
        },
        company: { select: { id: true, name: true } },
      },
    });

    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderDetail(order);
  }

  async getStats(companyId: string): Promise<OrderStats> {
    const prisma = this.prisma as any;

    const orders = await prisma.order.findMany({
      where: { companyId },
      select: { total: true, status: true },
    });

    const orderCount: number = orders.length;
    const totalSpent: number = orders.reduce(
      (sum: number, o: any) => sum + o.total,
      0,
    );
    const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

    const byStatus = orders.reduce(
      (acc: Record<string, number>, o: any) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { totalSpent, orderCount, avgOrderValue, byStatus };
  }

  toOrderDetail(order: any): OrderDetail {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      companyId: order.companyId,
      userId: order.userId,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        creditId: item.creditId,
        projectName: item.credit?.projectName || '',
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal,
      serviceFee: order.serviceFee,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      paidAt: order.paidAt,
      transactionHash: order.transactionHash,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt,
    };
  }
}
