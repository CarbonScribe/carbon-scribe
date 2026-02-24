import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/database/prisma.service';
import { RESERVATION_MINUTES } from '../interfaces/cart.interface';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Reserve credits for all cart items for RESERVATION_MINUTES minutes.
   * Uses an atomic transaction to prevent overselling under concurrent load.
   * Throws ConflictException if any item cannot be reserved.
   */
  async reserveCredits(
    cartId: string,
    items: Array<{ creditId: string; quantity: number }>,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESERVATION_MINUTES);

    await (this.prisma as any).$transaction(async (tx: any) => {
      for (const item of items) {
        // Fetch credit with row-level data inside transaction
        const credit = await tx.credit.findUnique({
          where: { id: item.creditId },
        });

        if (!credit) {
          throw new ConflictException(
            `Credit ${item.creditId} no longer exists`,
          );
        }

        // Sum existing active reservations for this credit (excluding this cart)
        const existing = await tx.creditReservation.aggregate({
          where: {
            creditId: item.creditId,
            cartId: { not: cartId },
            expiresAt: { gt: new Date() },
          },
          _sum: { quantity: true },
        });

        const reserved = existing._sum.quantity ?? 0;
        const effectivelyAvailable = credit.available - reserved;

        if (effectivelyAvailable < item.quantity) {
          throw new ConflictException(
            `Insufficient credits available for project "${credit.projectName}". ` +
              `Requested: ${item.quantity}, Effectively available: ${effectivelyAvailable}`,
          );
        }

        // Upsert reservation for this cart+credit pair
        await tx.creditReservation.upsert({
          where: {
            cartId_creditId: { cartId, creditId: item.creditId },
          },
          update: {
            quantity: item.quantity,
            expiresAt,
          },
          create: {
            cartId,
            creditId: item.creditId,
            quantity: item.quantity,
            expiresAt,
          },
        });
      }
    });
  }

  /**
   * Release all credit reservations held by a specific cart.
   * Called when cart is cleared, checkout is abandoned, or payment fails.
   */
  async releaseReservations(cartId: string): Promise<void> {
    const prisma = this.prisma as any;

    await prisma.creditReservation.deleteMany({
      where: { cartId },
    });
  }

  /**
   * Remove all expired reservations from the database.
   * Runs every 5 minutes via cron.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredReservations(): Promise<void> {
    const prisma = this.prisma as any;

    const result = await prisma.creditReservation.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (result.count > 0) {
      this.logger.log(`Released ${result.count} expired credit reservation(s)`);
    }
  }
}
