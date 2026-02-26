import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { IOrderStatusEvent } from '../interfaces/order.interface';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderStatus(
    orderId: string,
    companyId: string,
  ): Promise<{ status: string; timeline: IOrderStatusEvent[] }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId },
      select: {
        status: true,
        statusEvents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" not found`);
    }

    return {
      status: order.status,
      timeline: order.statusEvents as unknown as IOrderStatusEvent[],
    };
  }

  async getStatusHistory(
    orderId: string,
    companyId: string,
  ): Promise<IOrderStatusEvent[]> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" not found`);
    }

    const events = await this.prisma.orderStatusEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return events as unknown as IOrderStatusEvent[];
  }
}
