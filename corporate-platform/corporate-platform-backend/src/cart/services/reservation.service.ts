import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/database/prisma.service';
import { RESERVATION_MINUTES } from '../interfaces/cart.interface';
import { AvailabilityService } from '../../credit/services/availability.service';
import {
  AvailabilityChangeType,
  PrismaTxClient,
} from '../../credit/interfaces/availability.interface';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Reserve credits for all cart items for RESERVATION_MINUTES minutes.
   *
   * Runs inside a Serializable transaction and takes a `SELECT ... FOR UPDATE`
   * row lock on each credit (via {@link AvailabilityService.assertAvailableWithin})
   * before reading its availability, so two concurrent carts can no longer both
   * observe the same pre-reservation state and both succeed (#516).
   *
   * Throws ConflictException if any item cannot be reserved.
   */
  async reserveCredits(
    cartId: string,
    items: Array<{ creditId: string; quantity: number }>,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESERVATION_MINUTES);

    await this.availability.runSerializable(async (txClient: unknown) => {
      const tx = txClient as any;

      for (const item of items) {
        // Locks the credit row for the rest of this transaction and validates
        // the claim against availability minus *other* carts' active holds.
        const headroom = await this.availability.assertAvailableWithin(
          tx as PrismaTxClient,
          {
            creditId: item.creditId,
            amount: item.quantity,
            changeType: AvailabilityChangeType.RESERVE,
            reservationCartId: cartId,
            respectReservations: true,
          },
        );

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

        // A reservation is a hold rather than a decrement, so availableAmount
        // is unchanged — but the movement is still recorded so cart, order, and
        // retirement activity all show up in one ledger.
        await this.availability.logMovementWithin(tx as PrismaTxClient, {
          creditId: item.creditId,
          changedBy: `cart:${cartId}`,
          changeType: AvailabilityChangeType.RESERVE,
          amount: item.quantity,
          previousAmount: headroom.availableAmount,
          newAmount: headroom.availableAmount,
          reason: `cart reservation hold until ${expiresAt.toISOString()}`,
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

    const held = await prisma.creditReservation.findMany({
      where: { cartId },
    });

    await prisma.creditReservation.deleteMany({
      where: { cartId },
    });

    await this.logReleases(held, `cart:${cartId}`, 'cart reservation released');
  }

  /**
   * Remove all expired reservations from the database.
   * Runs every 5 minutes via cron.
   *
   * Sweeping a credit's expired reservations and confirmPurchase decrementing
   * that same credit must not interleave (#545): if the cron deleted a
   * reservation mid-way through a confirmPurchase transaction that depends on
   * it still being active, the two could disagree about whether that cart's
   * hold is still live. Both operations now lock the credit row first — via
   * the same {@link AvailabilityService.lockCredit} — so whichever gets there
   * first finishes its whole check-then-write before the other proceeds.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredReservations(): Promise<void> {
    const prisma = this.prisma as any;

    const expired = await prisma.creditReservation.findMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (expired.length === 0) return;

    const creditIds = Array.from(
      new Set(expired.map((row: { creditId: string }) => row.creditId)),
    ) as string[];

    const released: Array<{ creditId: string; quantity: number }> = [];

    for (const creditId of creditIds) {
      const releasedForCredit = await this.availability.runSerializable(
        async (txClient: unknown) => {
          const tx = txClient as any;
          await this.availability.lockCredit(tx as PrismaTxClient, creditId);

          const staleForCredit = await tx.creditReservation.findMany({
            where: { creditId, expiresAt: { lt: new Date() } },
          });

          if (staleForCredit.length === 0) return [];

          await tx.creditReservation.deleteMany({
            where: { creditId, expiresAt: { lt: new Date() } },
          });

          return staleForCredit;
        },
      );

      released.push(...releasedForCredit);
    }

    if (released.length > 0) {
      this.logger.log(
        `Released ${released.length} expired credit reservation(s)`,
      );
      await this.logReleases(released, 'system', 'reservation expired');
    }
  }

  /**
   * Record released holds on CreditAvailabilityLog. Best-effort: a bookkeeping
   * failure must not fail the release itself, which has already happened.
   */
  private async logReleases(
    reservations: Array<{ creditId: string; quantity: number }> | undefined,
    changedBy: string,
    reason: string,
  ): Promise<void> {
    if (!reservations?.length) return;

    const prisma = this.prisma as any;

    for (const reservation of reservations) {
      try {
        const credit = await prisma.credit.findFirst({
          where: { id: reservation.creditId },
        });
        const current = credit?.availableAmount ?? 0;

        await this.availability.logMovementWithin(prisma as PrismaTxClient, {
          creditId: reservation.creditId,
          changedBy,
          changeType: AvailabilityChangeType.RELEASE,
          amount: reservation.quantity,
          previousAmount: current,
          newAmount: current,
          reason,
        });
      } catch (error) {
        this.logger.warn(
          `Could not log reservation release for credit ${reservation.creditId}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
