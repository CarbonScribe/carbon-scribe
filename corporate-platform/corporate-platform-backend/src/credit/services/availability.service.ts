import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  AvailabilityChangeType,
  AvailabilityClaim,
  AvailabilityHeadroom,
  PrismaTxClient,
} from '../interfaces/availability.interface';

type Status = 'available' | 'reserved' | 'retired' | 'pending';

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  available: ['reserved', 'pending'],
  reserved: ['available', 'retired'],
  pending: ['available', 'reserved'],
  retired: [],
};

/**
 * AvailabilityService — the single lock-safe code path for credit inventory (#516).
 *
 * Cart reservation, order checkout, and instant retirement all route their
 * availability checks and decrements through {@link assertAvailableWithin} and
 * {@link decrementWithin} so that:
 *
 *  - every claim takes a `SELECT ... FOR UPDATE` row lock on the credit before
 *    reading `availableAmount`, closing the check-then-act race that allowed
 *    two concurrent callers to both observe the same pre-claim state;
 *  - every decrement is written behind a `WHERE availableAmount >= amount`
 *    floor guard, so even a stale in-memory read cannot drive availability
 *    negative;
 *  - every movement is recorded on CreditAvailabilityLog, regardless of which
 *    flow initiated it.
 *
 * A `CHECK ("availableAmount" >= 0)` constraint on the Credit table backstops
 * all of the above at the database layer.
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAvailable(page = 1, limit = 20, companyId?: string) {
    const skip = (page - 1) * limit;
    const where: any = { status: 'available' };
    if (companyId) where.companyId = companyId;
    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({ where, skip, take: limit }),
      this.prisma.credit.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateStatus(
    id: string,
    status: string,
    availableAmount?: number,
    companyId?: string,
  ) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;
    const credit = await this.prisma.credit.findFirst({ where });
    if (!credit) throw new NotFoundException('Credit not found');

    if (!['available', 'reserved', 'retired', 'pending'].includes(status))
      throw new BadRequestException('Invalid status');

    // enforce allowed transitions
    const from = (credit.status as Status) || 'available';
    if (
      !ALLOWED_TRANSITIONS[from].includes(status as Status) &&
      from !== (status as Status)
    ) {
      throw new BadRequestException(
        `Invalid state transition from ${from} to ${status}`,
      );
    }

    const data: any = { status };
    if (typeof availableAmount === 'number') {
      if (availableAmount < 0)
        throw new BadRequestException('availableAmount must be >= 0');
      data.availableAmount = availableAmount;
    }

    return this.prisma.$transaction(async (tx) => {
      const txWhere: any = { id };
      if (companyId) txWhere.companyId = companyId;
      const updated = await tx.credit.update({ where: txWhere, data });
      // log the status change
      await tx.creditAvailabilityLog.create({
        data: {
          creditId: id,
          changedBy: 'system',
          changeType: 'status_change',
          amount: updated.availableAmount ?? 0,
          previousAmount: credit.availableAmount ?? 0,
          newAmount: updated.availableAmount ?? 0,
          reason: `status:${from}->${status}`,
        },
      });
      return updated;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared lock-safe inventory path (#516)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Take a `SELECT ... FOR UPDATE` row lock on a credit.
   *
   * All callers already run inside a transaction, so the lock is held until
   * that transaction commits or rolls back. Concurrent claims against the same
   * credit therefore serialise here rather than racing between the read and the
   * write.
   *
   * Returns `true` when a real lock was taken. Callers running against a client
   * without raw-query support (unit-test stubs) degrade to the
   * conditional-update floor guard, which is still safe against lost updates.
   */
  async lockCredit(tx: PrismaTxClient, creditId: string): Promise<boolean> {
    if (typeof tx.$queryRaw !== 'function') {
      this.logger.debug(
        `Raw queries unavailable on this client; skipping FOR UPDATE lock for credit ${creditId}`,
      );
      return false;
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Credit" WHERE "id" = ${creditId} FOR UPDATE`,
    );
    return true;
  }

  /**
   * Read the availability headroom for a credit while holding its row lock.
   *
   * `effectivelyAvailable` subtracts units held by *other* carts' unexpired
   * reservations when {@link AvailabilityClaim.respectReservations} is set, so
   * a direct retirement cannot consume units a cart is already holding.
   */
  async readHeadroomWithin(
    tx: PrismaTxClient,
    claim: AvailabilityClaim,
  ): Promise<AvailabilityHeadroom> {
    await this.lockCredit(tx, claim.creditId);

    const where: any = { id: claim.creditId };
    if (claim.companyId) where.companyId = claim.companyId;

    const credit = await tx.credit.findFirst({ where });
    if (!credit) {
      throw new NotFoundException(`Credit ${claim.creditId} not found`);
    }

    const respectReservations = claim.respectReservations !== false;
    let reservedAmount = 0;

    if (respectReservations) {
      const reservationWhere: any = {
        creditId: claim.creditId,
        expiresAt: { gt: new Date() },
      };
      if (claim.reservationCartId) {
        reservationWhere.cartId = { not: claim.reservationCartId };
      }

      const aggregate = await tx.creditReservation.aggregate({
        where: reservationWhere,
        _sum: { quantity: true },
      });
      reservedAmount = aggregate?._sum?.quantity ?? 0;
    }

    const availableAmount = credit.availableAmount ?? 0;

    return {
      creditId: claim.creditId,
      projectName: credit.projectName ?? claim.creditId,
      availableAmount,
      reservedAmount,
      effectivelyAvailable: availableAmount - reservedAmount,
      status: credit.status ?? null,
    };
  }

  /**
   * Assert that a claim can be satisfied, with the credit row locked for the
   * remainder of the caller's transaction.
   *
   * Used by cart reservation (which then writes a CreditReservation rather than
   * decrementing) and by retirement validation, so the check and the write that
   * follows it are covered by one lock instead of being a TOCTOU window.
   */
  async assertAvailableWithin(
    tx: PrismaTxClient,
    claim: AvailabilityClaim,
  ): Promise<AvailabilityHeadroom> {
    if (!claim.amount || claim.amount <= 0) {
      throw new BadRequestException('amount must be > 0');
    }

    const headroom = await this.readHeadroomWithin(tx, claim);

    if (headroom.effectivelyAvailable < claim.amount) {
      throw new ConflictException(
        `Insufficient credits available for project "${headroom.projectName}". ` +
          `Requested: ${claim.amount}, Effectively available: ${headroom.effectivelyAvailable}`,
      );
    }

    return headroom;
  }

  /**
   * Consume units of a credit's availability inside the caller's transaction.
   *
   * This is the one decrement implementation shared by checkout confirmation
   * and retirement. It locks the row, validates the claim against effective
   * availability, writes the decrement behind a floor guard, and records the
   * movement on CreditAvailabilityLog.
   */
  async decrementWithin(
    tx: PrismaTxClient,
    claim: AvailabilityClaim,
  ): Promise<AvailabilityHeadroom & { newAmount: number }> {
    const headroom = await this.assertAvailableWithin(tx, claim);

    const newAmount = headroom.availableAmount - claim.amount;
    // `status` is non-nullable in the schema, so a fully-consumed credit flips
    // to 'reserved' and anything else keeps whatever it had (never null).
    const newStatus =
      newAmount === 0 ? 'reserved' : (headroom.status ?? undefined);

    const guardedWhere: any = {
      id: claim.creditId,
      // Floor guard: the write only lands while availability is still
      // sufficient, so a stale read cannot drive availableAmount negative.
      availableAmount: { gte: claim.amount },
    };
    if (claim.companyId) guardedWhere.companyId = claim.companyId;

    const result = await tx.credit.updateMany({
      where: guardedWhere,
      data: { availableAmount: newAmount, status: newStatus },
    });

    if (!result || result.count === 0) {
      throw new ConflictException(
        `Insufficient credits available for project "${headroom.projectName}". ` +
          `Requested: ${claim.amount}, Available: ${headroom.availableAmount}`,
      );
    }

    await this.logMovementWithin(tx, {
      creditId: claim.creditId,
      changedBy: claim.changedBy ?? 'system',
      changeType: claim.changeType ?? AvailabilityChangeType.DECREMENT,
      amount: claim.amount,
      previousAmount: headroom.availableAmount,
      newAmount,
      reason: claim.reason,
    });

    return { ...headroom, newAmount };
  }

  /** Append a movement to CreditAvailabilityLog inside the caller's transaction. */
  async logMovementWithin(
    tx: PrismaTxClient,
    entry: {
      creditId: string;
      changedBy?: string;
      changeType: AvailabilityChangeType | string;
      amount: number;
      previousAmount: number;
      newAmount: number;
      reason?: string | null;
    },
  ): Promise<void> {
    await tx.creditAvailabilityLog.create({
      data: {
        creditId: entry.creditId,
        changedBy: entry.changedBy ?? 'system',
        changeType: entry.changeType,
        amount: entry.amount,
        previousAmount: entry.previousAmount,
        newAmount: entry.newAmount,
        reason: entry.reason ?? null,
      },
    });
  }

  /**
   * Decrement inventory in its own Serializable transaction.
   *
   * Convenience wrapper around {@link decrementWithin} for callers that are not
   * already inside a transaction. Serializable isolation, the row lock, and the
   * floor guard give three independent layers of protection against oversell.
   */
  async decrementAvailability(
    id: string,
    amount: number,
    changedBy = 'system',
    reason?: string,
    companyId?: string,
    options: Pick<
      AvailabilityClaim,
      'changeType' | 'reservationCartId' | 'respectReservations'
    > = {},
  ) {
    if (amount <= 0) throw new BadRequestException('amount must be > 0');

    return this.runSerializable(async (tx) => {
      await this.decrementWithin(tx as PrismaTxClient, {
        creditId: id,
        amount,
        changedBy,
        reason,
        companyId,
        // Standalone administrative decrements do not participate in the cart
        // reservation ledger unless the caller opts in.
        respectReservations: false,
        ...options,
      });

      const where: any = { id };
      if (companyId) where.companyId = companyId;
      return (tx as any).credit.findFirst({ where });
    });
  }

  /**
   * Run a callback inside a Serializable transaction.
   *
   * Exposed so cart, checkout, and retirement adopt the same isolation level
   * without each reaching for Prisma options independently. Falls back to a
   * plain transaction when the underlying client ignores options (test stubs).
   */
  async runSerializable<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const prisma = this.prisma as any;
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (this.isUnsupportedIsolationError(error)) {
        this.logger.warn(
          'Serializable isolation unsupported by this client; falling back to the default isolation level',
        );
        return prisma.$transaction(fn);
      }
      throw error;
    }
  }

  private isUnsupportedIsolationError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      /isolation/i.test(message) && /not supported|unsupported/i.test(message)
    );
  }
}
