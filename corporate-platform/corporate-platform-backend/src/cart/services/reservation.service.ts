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
   * Uses row-level locking via SELECT ... FOR UPDATE on affected credits to
   * prevent interleaving with concurrent confirmPurchase operations. This ensures
   * that:
   *
   * 1. If a reservation expires while confirmPurchase is mid-transaction, both
   *    operations serialize on the same credit row lock.
   * 2. The cron job sees a consistent view of all reservations for a credit
   *    before deciding which ones are actually expired.
   * 3. No stale reservation data is passed to other concurrent carts' availability
   *    calculations.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredReservations(): Promise<void> {
    const prisma = this.prisma as any;

    // Find all expired reservations
    const expired = await prisma.creditReservation.findMany({
      where: { expiresAt: { lt: new Date() } },
      include: { credit: true },
    });

    if (!expired.length) {
      return;
    }

    // Group by creditId to minimize lock acquisitions
    const expiredByCredit = new Map<string, typeof expired>();
    for (const reservation of expired) {
      if (!expiredByCredit.has(reservation.creditId)) {
        expiredByCredit.set(reservation.creditId, []);
      }
      expiredByCredit.get(reservation.creditId)!.push(reservation);
    }

    // Process each credit's expired reservations in a Serializable transaction
    // with an explicit row lock, so the cron job doesn't race with confirmPurchase
    for (const [creditId, _creditExpired] of expiredByCredit) {
      try {
        await this.availability.runSerializable(async (txClient) => {
          const tx = txClient as any;

          // Lock the credit row for the rest of this transaction
          await this.availability.lockCredit(tx, creditId);

          // Re-fetch the reservations under the lock to get a fresh view
          // (they may have been released or renewed by another transaction)
          const currentlyExpired = await tx.creditReservation.findMany({
            where: {
              creditId,
              expiresAt: { lt: new Date() },
            },
          });

          if (currentlyExpired.length === 0) {
            // All were released or renewed by another transaction
            return;
          }

          // Delete the currently-expired ones
          await tx.creditReservation.deleteMany({
            where: {
              creditId,
              expiresAt: { lt: new Date() },
            },
          });

          // Log releases for each one
          for (const reservation of currentlyExpired) {
            try {
              const credit = await tx.credit.findFirst({
                where: { id: creditId },
              });
              const current = credit?.availableAmount ?? 0;

              await this.availability.logMovementWithin(tx, {
                creditId,
                changedBy: 'system',
                changeType: AvailabilityChangeType.RELEASE,
                amount: reservation.quantity,
                previousAmount: current,
                newAmount: current,
                reason: `reservation expired at ${reservation.expiresAt.toISOString()}`,
              });
            } catch (logError) {
              this.logger.warn(
                `Could not log reservation release for credit ${creditId}: ` +
                  `${logError instanceof Error ? logError.message : String(logError)}`,
              );
            }
          }

          this.logger.log(
            `Released ${currentlyExpired.length} expired credit reservation(s) for credit ${creditId}`,
          );
        });
      } catch (error) {
        this.logger.error(
          `Failed to release expired reservations for credit ${creditId}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with other credits rather than failing the entire cron job
      }
    }
  }

  /**
   * Record released holds on CreditAvailabilityLog for manual release operations.
   * Best-effort: a bookkeeping failure must not fail the release itself.
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
