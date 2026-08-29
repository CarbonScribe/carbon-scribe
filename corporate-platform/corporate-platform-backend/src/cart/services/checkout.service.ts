import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { UnitOfWorkService } from '../../shared/database/unit-of-work.service';
import { PaymentService } from './payment.service';
import { ReservationService } from './reservation.service';
import { AuditService } from './audit.service';
import { CheckoutDto } from '../dto/checkout.dto';
import {
  CheckoutResult,
  ConfirmResult,
} from '../interfaces/checkout.interface';
import { SERVICE_FEE_RATE } from '../interfaces/cart.interface';
import { PostPurchaseService } from '../../retirement/services/post-purchase.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import {
  AvailabilityChangeType,
  PrismaTxClient,
} from '../../credit/interfaces/availability.interface';
import { ProducerService } from '../../event-bus/producer.service';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private unitOfWork: UnitOfWorkService,
    private paymentService: PaymentService,
    private reservationService: ReservationService,
    private auditService: AuditService,
    private postPurchaseService: PostPurchaseService,
    private availability: AvailabilityService,
    private producerService: ProducerService,
  ) {}

  async initiateCheckout(
    companyId: string,
    userId: string,
    dto: CheckoutDto,
  ): Promise<CheckoutResult> {
    // 1. Get the active cart
    const prisma = this.prisma as any;

    const cart = await prisma.cart.findFirst({
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

    // 2. Advisory availability check for a fast, friendly failure. The binding
    //    check happens in reserveCredits below, which locks each credit row
    //    before reading it (#516).
    for (const item of cart.items) {
      if ((item.credit.availableAmount ?? 0) < item.quantity) {
        throw new BadRequestException(
          `Insufficient credits for "${item.credit.projectName}". ` +
            `Requested: ${item.quantity}, Available: ${item.credit.availableAmount}`,
        );
      }
    }

    // 3. Reserve credits for 15 minutes to prevent overselling
    await this.reservationService.reserveCredits(
      cart.id,
      cart.items.map((i) => ({ creditId: i.creditId, quantity: i.quantity })),
    );

    // 4. Create order in a transaction using UnitOfWorkService
    const order = await this.unitOfWork.run(async (tx: any) => {
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
    const prisma = this.prisma as any;

    const order = await prisma.order.findUnique({
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

    // 2. Advisory re-check before the (potentially slow) payment call, so an
    //    obviously-unsatisfiable order fails without charging anyone. This read
    //    is not authoritative: availability is re-checked under the credit's
    //    row lock in step 4, closing the TOCTOU window the payment call opens.
    for (const item of order.items) {
      if ((item.credit.availableAmount ?? 0) < item.quantity) {
        // Release reservations and mark order as failed
        if (order.cartId) {
          await this.reservationService.releaseReservations(order.cartId);
        }

        await prisma.order.update({
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

      await prisma.order.update({
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

    // 4. Complete the purchase in a Serializable transaction. This atomically:
    //    a) Verifies the order's backing credit reservations are still active
    //    b) Re-validates availability under row locks
    //    c) Performs the decrements behind floor guards
    //    d) Records all movements in CreditAvailabilityLog
    //    Together, these ensure no race between payment and decrement.
    const completedOrder = await this.unitOfWork.run(async (tx: any) => {
      // 4a. Before decrementing, verify that the reservations backing this
      //     order are still active (not expired). If a reservation expired
      //     between initiateCheckout and now, fail gracefully rather than
      //     accepting an invalid order.
      if (order.cartId) {
        const reservations = await tx.creditReservation.findMany({
          where: {
            cartId: order.cartId,
            expiresAt: { lt: new Date() }, // Find ANY that have expired
          },
        });

        if (reservations.length > 0) {
          throw new BadRequestException(
            `Order cannot be confirmed: reservation(s) have expired. ` +
              `Please recreate your cart and try again.`,
          );
        }
      }

      // 4b & 4c. Decrease credit availability for each item through the shared,
      //          lock-safe path. It re-locks each credit row inside this
      //          transaction, re-checks availability (closing the TOCTOU window opened
      //          by the payment call above), writes the decrement behind a floor guard
      //          so availableAmount can never go negative, and records the movement on
      //          CreditAvailabilityLog. This cart's own reservation is excluded from the
      //          headroom calculation so the order can consume the units it is holding.
      for (const item of order.items) {
        await this.availability.decrementWithin(tx as PrismaTxClient, {
          creditId: item.creditId,
          amount: item.quantity,
          changedBy: order.userId ?? 'system',
          changeType: AvailabilityChangeType.PURCHASE,
          reason: `order:${orderId}`,
          reservationCartId: order.cartId ?? undefined,
          respectReservations: true,
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

      completionEvent = {
        id: `order:${updated.id}:completed`,
        type: 'order.completed',
        source: 'corporate-platform',
        timestamp: new Date().toISOString(),
        correlationId: updated.id,
        userId: updated.userId ?? undefined,
        companyId: updated.companyId,
        data: updated,
        version: '1.0',
      };

      await this.producerService.publish(
        'order-events',
        completionEvent,
        undefined,
        { tx },
      );

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
    });

    await this.producerService.publishPending(
      'order-events',
      `order-events:${completionEvent.id}:${completionEvent.type}`,
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

    // 6. Trigger post-purchase transfers
    await this.postPurchaseService.handleOrderCompleted(completedOrder.id);

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
