import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { PaymentService } from './payment.service';
import { ReservationService } from './reservation.service';
import { AuditService } from './audit.service';
import { CheckoutDto } from '../dto/checkout.dto';
import {
  CheckoutResult,
  ConfirmResult,
} from '../interfaces/checkout.interface';
import { SERVICE_FEE_RATE } from '../interfaces/cart.interface';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private reservationService: ReservationService,
    private auditService: AuditService,
  ) {}

  async initiateCheckout(
    companyId: string,
    userId: string,
    dto: CheckoutDto,
  ): Promise<CheckoutResult> {
    // 1. Get the active cart
    const cart = await this.prisma.cart.findFirst({
      where: {
        companyId,
        expiresAt: { gt: new Date() },
      },
      include: {
        items: {
          include: { credit: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 2. Validate all items are still available
    for (const item of cart.items) {
      if (item.credit.available < item.quantity) {
        throw new BadRequestException(
          `Insufficient credits for "${item.credit.projectName}". ` +
            `Requested: ${item.quantity}, Available: ${item.credit.available}`,
        );
      }
    }

    // 3. Reserve credits for 15 minutes to prevent overselling
    await this.reservationService.reserveCredits(
      cart.id,
      cart.items.map((i) => ({ creditId: i.creditId, quantity: i.quantity })),
    );

    // 4. Create order in a transaction
    const order = await (this.prisma as any).$transaction(async (tx: any) => {
      // Generate order number
      const orderNumber = await this.generateOrderNumber(tx);

      // Calculate totals from cart items
      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const serviceFee = subtotal * SERVICE_FEE_RATE;
      const total = subtotal + serviceFee;

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          companyId,
          userId,
          cartId: cart.id,
          subtotal,
          serviceFee,
          total,
          status: 'pending',
          paymentMethod: dto.paymentMethod || 'credit_card',
          notes: dto.notes,
        },
      });

      // Create order items (price snapshot)
      for (const item of cart.items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            creditId: item.creditId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
          },
        });
      }

      return newOrder;
    });

    // 5. Write audit event
    await this.auditService.logOrderEvent(
      order.id,
      'created',
      null,
      'pending',
      userId,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    };
  }

  async confirmPurchase(
    orderId: string,
    companyId: string,
  ): Promise<ConfirmResult> {
    // 1. Find the order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { credit: true },
        },
      },
    });

    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Order cannot be confirmed. Current status: ${order.status}`,
      );
    }

    // 2. Re-validate credit availability (double-check, reservation handles concurrency)
    for (const item of order.items) {
      if (item.credit.available < item.quantity) {
        // Release reservations and mark order as failed
        if (order.cartId) {
          await this.reservationService.releaseReservations(order.cartId);
        }

        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        });

        await this.auditService.logOrderEvent(
          orderId,
          'credits_unavailable',
          'pending',
          'failed',
          undefined,
          { creditId: item.creditId, requested: item.quantity },
        );

        throw new BadRequestException(
          `Credits no longer available for "${item.credit.projectName}". ` +
            `Order has been marked as failed.`,
        );
      }
    }

    // 3. Process payment
    const paymentResult = await this.paymentService.processPayment(
      orderId,
      order.paymentMethod || 'credit_card',
      order.total,
    );

    if (paymentResult.status !== 'approved') {
      // Release reservations and mark failed
      if (order.cartId) {
        await this.reservationService.releaseReservations(order.cartId);
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'failed' },
      });

      await this.auditService.logOrderEvent(
        orderId,
        'payment_declined',
        'pending',
        'failed',
      );

      throw new BadRequestException('Payment was declined');
    }

    // 4. Complete the purchase in a transaction
    const completedOrder = await (this.prisma as any).$transaction(
      async (tx: any) => {
        // Decrease credit availability for each item
        for (const item of order.items) {
          await tx.credit.update({
            where: { id: item.creditId },
            data: { available: { decrement: item.quantity } },
          });
        }

        // Update order status
        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'completed',
            paymentId: paymentResult.paymentId,
            transactionHash: paymentResult.transactionHash,
            paidAt: new Date(),
            completedAt: new Date(),
          },
          include: {
            items: {
              include: { credit: true },
            },
          },
        });

        // Clear the cart and its reservations
        if (order.cartId) {
          await tx.creditReservation.deleteMany({
            where: { cartId: order.cartId },
          });
          await tx.cartItem.deleteMany({
            where: { cartId: order.cartId },
          });
          await tx.cart.update({
            where: { id: order.cartId },
            data: {
              subtotal: 0,
              serviceFee: 0,
              total: 0,
            },
          });
        }

        return updated;
      },
    );

    // 5. Write audit event
    await this.auditService.logOrderEvent(
      orderId,
      'confirmed',
      'pending',
      'completed',
      undefined,
      { paymentId: paymentResult.paymentId },
    );

    return {
      order: {
        id: completedOrder.id,
        orderNumber: completedOrder.orderNumber,
        companyId: completedOrder.companyId,
        userId: completedOrder.userId,
        items: completedOrder.items.map((item: any) => ({
          id: item.id,
          creditId: item.creditId,
          projectName: item.credit?.projectName || '',
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        })),
        subtotal: completedOrder.subtotal,
        serviceFee: completedOrder.serviceFee,
        total: completedOrder.total,
        status: completedOrder.status,
        paymentMethod: completedOrder.paymentMethod,
        paymentId: completedOrder.paymentId,
        paidAt: completedOrder.paidAt,
        transactionHash: completedOrder.transactionHash,
        notes: completedOrder.notes,
        createdAt: completedOrder.createdAt,
        updatedAt: completedOrder.updatedAt,
        completedAt: completedOrder.completedAt,
      },
      transactionHash: paymentResult.transactionHash,
    };
  }

  private async generateOrderNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.order.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `ORD-${year}-${sequence}`;
  }
}
