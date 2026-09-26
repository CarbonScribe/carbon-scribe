/**
 * Shared inventory-reservation semantics for carbon credit availability (#516).
 *
 * Cart reservation, order checkout, and instant retirement all mutate the same
 * scarce resource — `Credit.availableAmount` — and historically each flow
 * reinvented its own check-then-act decrement. These types describe the single
 * lock-safe contract that all three now share via
 * {@link AvailabilityService.decrementWithin} and
 * {@link AvailabilityService.assertAvailableWithin}.
 */

/** Prisma transaction client (or the base client) used by the shared helpers. */
export type PrismaTxClient = {
  credit: {
    findFirst: (args: unknown) => Promise<any>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  creditReservation: {
    aggregate: (
      args: unknown,
    ) => Promise<{ _sum: { quantity: number | null } }>;
  };
  creditAvailabilityLog: { create: (args: unknown) => Promise<unknown> };
  $queryRaw?: (...args: any[]) => Promise<unknown>;
};

/**
 * Why availability is being consumed. Recorded on every CreditAvailabilityLog
 * row so cart, order, and retirement movements are distinguishable in audit.
 */
export enum AvailabilityChangeType {
  /** Cart hold — a CreditReservation row, not yet a decrement. */
  RESERVE = 'reserve',
  /** Cart hold released (expired, cart cleared, checkout abandoned). */
  RELEASE = 'release',
  /** Order confirmation consuming previously reserved units. */
  PURCHASE = 'purchase',
  /** Irreversible retirement consuming units. */
  RETIRE = 'retire',
  /** Generic administrative decrement. */
  DECREMENT = 'decrement',
  /** Availability restored (refund, cancellation). */
  INCREMENT = 'increment',
}

/** A request to consume units of a credit's availability. */
export interface AvailabilityClaim {
  /** Credit whose availability is being consumed. */
  creditId: string;
  /** Units to consume. Must be > 0. */
  amount: number;
  /** Actor recorded on the audit log row (userId or `system`). */
  changedBy?: string;
  /** Human-readable reason recorded on the audit log row. */
  reason?: string;
  /** Tenant scope — when set, the credit must belong to this company. */
  companyId?: string;
  /** Movement classification recorded on the audit log row. */
  changeType?: AvailabilityChangeType;
  /**
   * Cart whose active reservation already covers these units. Its held
   * quantity is excluded from the reserved-headroom calculation so a cart is
   * never blocked by its own hold.
   */
  reservationCartId?: string;
  /**
   * When true (the default), units held by *other* carts' active reservations
   * are treated as unavailable. Retirement and checkout both opt in so a
   * concurrent cart hold and a direct retirement cannot claim the same units.
   */
  respectReservations?: boolean;
}

/** Availability snapshot taken while the credit row is locked. */
export interface AvailabilityHeadroom {
  creditId: string;
  projectName: string;
  /** Raw `Credit.availableAmount`. */
  availableAmount: number;
  /** Units held by active reservations counted against this claim. */
  reservedAmount: number;
  /** `availableAmount - reservedAmount` — what the caller may actually take. */
  effectivelyAvailable: number;
  status: string | null;
}
