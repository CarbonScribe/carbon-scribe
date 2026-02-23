import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

export type OrderEvent =
  | 'created'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'payment_declined'
  | 'credits_unavailable';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Record an immutable audit event for an order state transition.
   * Silently logs on failure to avoid disrupting the primary flow.
   */
  async logOrderEvent(
    orderId: string,
    event: OrderEvent,
    fromStatus: string | null,
    toStatus: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.orderAuditLog.create({
        data: {
          orderId,
          event,
          fromStatus: fromStatus ?? undefined,
          toStatus,
          userId,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });
    } catch (err) {
      // Audit failures must not break the primary business flow
      this.logger.error(
        `Failed to write audit log for order ${orderId}: ${err}`,
      );
    }
  }

  /**
   * Retrieve the full audit history for an order.
   */
  async getOrderAuditHistory(orderId: string) {
    return this.prisma.orderAuditLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
