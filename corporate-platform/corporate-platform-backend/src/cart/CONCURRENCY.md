# Cart / checkout concurrency model

This document describes how the cart, checkout, and credit-availability code
guarantees that concurrent requests can never oversell a `Credit`'s
`availableAmount`. It exists so a future contributor changing any of
`reservation.service.ts`, `checkout.service.ts`, or `availability.service.ts`
can see the invariants those files depend on without having to reconstruct
them from the diffs of #516 and #545.

## The scarce resource

`Credit.availableAmount` is read and written by three independent flows:

- **Cart reservation** (`ReservationService.reserveCredits`) — places a
  time-boxed hold (`CreditReservation`) without decrementing `availableAmount`.
- **Checkout confirmation** (`CheckoutService.confirmPurchase`) — consumes a
  cart's hold and decrements `availableAmount`.
- **Instant retirement** — decrements `availableAmount` directly, with no
  cart or reservation involved.

All three route their reads and writes through one shared code path,
`AvailabilityService`, rather than each reinventing a check-then-act
decrement. That is the single fact that makes the rest of this document true.

## Three independent layers of protection

Every claim against a credit's availability goes through
`AvailabilityService.assertAvailableWithin` (reservation) or
`AvailabilityService.decrementWithin` (checkout, retirement), which stack
three independent guarantees:

1. **A `SELECT ... FOR UPDATE` row lock** (`AvailabilityService.lockCredit`),
   taken before `availableAmount` is read. Two concurrent transactions
   claiming the same credit serialise on this lock instead of both observing
   the same pre-claim state — this is what closes the classic
   check-then-act race.
2. **A floor-guarded write.** The decrement is `credit.updateMany({ where: {
   id, availableAmount: { gte: amount } }, ... })`. Even if the row lock were
   somehow bypassed, a write that would drive `availableAmount` negative
   simply matches zero rows and is rejected — it can never partially apply.
3. **A database `CHECK` constraint** (migration
   `20260825120000_inventory_guard_and_transfer_submitted_state`):
   `ALTER TABLE "Credit" ADD CONSTRAINT "Credit_availableAmount_non_negative"
   CHECK ("availableAmount" >= 0)`. This is the last-resort backstop against
   a future logic bug or a direct SQL statement that bypasses the service
   layer entirely.

Every transaction that touches availability is also run at **Serializable**
isolation (`AvailabilityService.runSerializable`), which is defense in depth
on top of the row lock, not a replacement for it — the row lock is what
Postgres actually blocks concurrent transactions on; the isolation level
additionally protects against phantom reads across unrelated rows read in
the same transaction.

## Reservations vs. raw availability

A `CreditReservation` is a **hold**, not a decrement: `availableAmount` is
unchanged when one is created. `AvailabilityService.readHeadroomWithin`
computes `effectivelyAvailable = availableAmount - reservedAmount`, where
`reservedAmount` sums *other* carts' unexpired reservations
(`AvailabilityClaim.respectReservations`). This means:

- A cart's own reservation never blocks that same cart
  (`AvailabilityClaim.reservationCartId` excludes it from the sum).
- A direct retirement or another cart's checkout cannot consume units a
  live reservation is already holding.
- Reservations must not be allowed to collectively exceed
  `availableAmount` — `reserveCredits` enforces this by taking the same row
  lock and re-validating headroom before granting a new hold, so by
  construction the sum of all live reservations for a credit never exceeds
  its `availableAmount`. Tests that want to exercise the checkout-time race
  in isolation from this invariant use cart-less orders
  (`Order.cartId` is nullable) rather than seeding an inconsistent
  reservation state that the real system could never reach.

## Reservation expiry cannot race a confirmation

Reservations expire and are swept by `ReservationService.releaseExpiredReservations`
(cron, every 5 minutes). Two failure modes are guarded against explicitly:

- **Stale confirmation.** `confirmPurchase` no longer trusts raw
  `availableAmount` alone: before decrementing each item, it re-checks (inside
  the same locked transaction) that the order's own `CreditReservation` row is
  still present and unexpired. If it isn't — because the cron swept it, or it
  was released some other way — the item's decrement is rejected with a
  distinct error (`ReservationExpiredError`) rather than silently succeeding
  against a claim that is no longer actually held.
- **Interleaved sweep.** The cron job locks each affected credit row (via the
  same `AvailabilityService.lockCredit`) before deleting its expired
  reservations, exactly like `confirmPurchase` does before decrementing.
  Whichever operation acquires the lock first for a given credit completes
  its entire check-then-write before the other can proceed — the sweep and a
  confirmation can never observe or act on each other's half-finished state.

## Failure handling in `confirmPurchase`

`confirmPurchase` processes payment (step 3) *before* the authoritative,
lock-protected availability check and decrement (step 4), because payment
capture is comparatively slow and we don't want to hold the credit's row
lock across it. This means step 4 can legitimately fail — the availability
race was lost, or the reservation expired — *after* the customer has already
been charged. When that happens, `confirmPurchase`:

1. Logs a structured warning distinguishing this "oversold, rejected" case
   from other failure types (`AvailabilityService.decrementWithin` also logs
   at the point the guarded update matches zero rows, for the same reason).
2. Refunds the payment (`PaymentService.refundPayment`) — the customer is
   never left charged for an order that cannot be fulfilled.
3. Releases the order's cart reservation, marks the order `failed`, and
   writes an audit log entry, mirroring the existing `payment_declined` and
   step-2 advisory-check failure paths.
4. Throws `BadRequestException` (not the internal `ConflictException` that
   `AvailabilityService` raises), consistent with every other
   caller-facing rejection in this module.

The advisory check in step 2 (before payment is even attempted) is
intentionally *not* authoritative — it exists purely so an
obviously-unsatisfiable order fails fast without charging anyone. The only
check that actually gates the decrement is the one inside step 4's locked
transaction.

## What a new caller must do

Anything that consumes or holds `Credit.availableAmount` should call
`AvailabilityService.assertAvailableWithin` / `decrementWithin` /
`lockCredit` rather than reading or writing `Credit.availableAmount`
directly. A bare `prisma.credit.update` on `availableAmount` bypasses every
guarantee described above except the database `CHECK` constraint.
