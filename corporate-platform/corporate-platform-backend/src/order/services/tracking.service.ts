import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  OrderStatus,
  OrderStatusEvent,
  OrderStatusResult,
} from '../interfaces/order.interface';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderStatus(
    companyId: string,
    orderId: string,
  ): Promise<OrderStatusResult> {
    const prisma = this.prisma as any;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('Order not found');
    }

    const events: OrderStatusEvent[] = (order.auditLogs || []).map(
      (log: any) => ({
        event: log.event,
        fromStatus: log.fromStatus ?? null,
        toStatus: log.toStatus,
        userId: log.userId ?? undefined,
        metadata: log.metadata ? this.safeParseJson(log.metadata) : undefined,
        createdAt: log.createdAt,
      }),
    );

    const failureEvent = events.find(
      (e) => e.event === 'failed' || e.toStatus === 'failed',
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status as OrderStatus,
      updatedAt: order.updatedAt,
      events,
      failureReason: failureEvent?.metadata?.['reason'] as string | undefined,
    };
  }

  private safeParseJson(value: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
}
