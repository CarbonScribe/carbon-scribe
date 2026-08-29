# CarbonScribe Cart Checkout Concurrency Guarantees

## Overview

This document describes the concurrency model, isolation levels, and locking strategies used in the cart reservation, checkout, and credit availability systems to prevent overselling and ensure strong consistency guarantees for carbon credit inventory.

## Problem Statement

Prior implementations had the following race condition vulnerabilities:

1. **Check-Then-Act Window**: Availability was checked in one transaction and decremented in another, leaving a window where concurrent orders could both observe sufficient availability and attempt simultaneous decrements.

2. **No Floor Guard**: The `availableAmount` field could be driven negative by concurrent updates that used simple `{ decrement: quantity }` without a `WHERE availableAmount >= quantity` clause.

3. **Advisory-Only Checks**: Early validation checks were informational but not binding, so payment could succeed before the real availability was re-checked.

4. **Stale Reservation Data**: Reservation expiry cleanup (cron job) and concurrent order confirmations could race, resulting in stale reservation counts in availability calculations.

5. **No Database-Level Guard**: A programming error could corrupt `availableAmount` below zero, and the database itself had no constraint to prevent it.

## Solution: Three Layers of Protection

The solution implements three independent layers of protection:

### Layer 1: Serializable Transaction Isolation

All availability checks and decrements happen within **Serializable** transactions:

```typescript
// Checkout confirmation
await this.availability.runSerializable(async (tx) => {
  // All operations within this callback see a consistent, isolated view
  // Concurrent transactions serialize at row granularity
});
```

**Isolation Level**: `Serializable` (PostgreSQL) prevents all race conditions at the transaction level by ensuring that the outcome is equivalent to some serial ordering of the transactions.

**Code Location**:
- `AvailabilityService.runSerializable()` - wrapper that applies Serializable isolation with 15-second timeout
- `CheckoutService.confirmPurchase()` - uses `unitOfWork.run()` which internally uses runSerializable
- `ReservationService` - both `reserveCredits()` and `releaseExpiredReservations()` use Serializable transactions

### Layer 2: Pessimistic Row Locking with SELECT ... FOR UPDATE

Within each Serializable transaction, all operations take an explicit **SELECT ... FOR UPDATE** lock on the Credit row:

```typescript
// Lock the credit row for the rest of this transaction
await this.availability.lockCredit(tx, creditId);

// All subsequent reads see the current value and are protected by the lock
const headroom = await this.readHeadroomWithin(tx, claim);
```

**How it works**:
1. The lock is acquired before reading any availability data
2. The lock is held until the transaction commits
3. Concurrent transactions block on the lock, preventing interleaved reads/writes
4. Both application-layer and cron-job reservations use the same locking path

**Code Location**:
- `AvailabilityService.lockCredit()` - acquires `SELECT ... FOR UPDATE` lock
- `AvailabilityService.readHeadroomWithin()` - always locks before reading
- `AvailabilityService.assertAvailableWithin()` - uses readHeadroomWithin
- `AvailabilityService.decrementWithin()` - uses assertAvailableWithin before decrement

### Layer 3: Floor Guard on Decrement

Every decrement is written behind a **WHERE** clause that re-verifies the floor:

```typescript
const result = await tx.credit.updateMany({
  where: {
    id: claim.creditId,
    // Only update if still sufficient (the floor guard)
    availableAmount: { gte: claim.amount },
  },
  data: { 
    availableAmount: { decrement: claim.amount },
    // ...
  },
});

// If zero rows updated, the decrement was rejected due to insufficient funds
if (result.count === 0) {
  throw new ConflictException('Insufficient credits...');
}
```

**Why it matters**: Even if the application logic had a bug or a stale read occurred, the floor guard prevents the database itself from recording a negative value. If two transactions try to decrement concurrently and only one should succeed, the second one will detect `count === 0` and be rejected.

**Code Location**:
- `AvailabilityService.decrementWithin()` - implements the floor guard
- `CheckoutService.confirmPurchase()` - calls decrementWithin for each order item

### Layer 4 (Database Level): CHECK Constraint

The database has a **CHECK constraint** that makes it impossible for any operation—whether application or direct SQL—to write a negative value:

```sql
-- In Prisma schema:
model Credit {
  availableAmount Int @default(0)
  // ...
  @@check("\"availableAmount\" >= 0")
}

-- In PostgreSQL:
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_availableAmount_floor" 
  CHECK ("availableAmount" >= 0);
```

**Guarantees**: No INSERT or UPDATE statement can ever result in a negative `availableAmount`, regardless of application code or direct SQL.

**Migration**: `20260829120000_add_credit_availability_floor_constraint`

## Concurrency Scenarios

### Scenario 1: Two Concurrent Checkouts on Same Credit

**Initial State**:
- Credit has 100 units available
- Cart A reserves 60 units
- Cart B reserves 60 units

**Timeline**:

```
T1: Cart A calls confirmPurchase()
    └─ Enters Serializable transaction
    └─ Attempts to lock credit row → acquires lock
    └─ Reads headroom: 100 available, 60 reserved (by Cart B), 40 effective
    └─ Payment succeeds

T2: Cart B calls confirmPurchase()
    └─ Enters Serializable transaction
    └─ Attempts to lock credit row → BLOCKS (Cart A holds the lock)

T3: Cart A completes decrement
    └─ availableAmount = 100 - 60 = 40
    └─ Releases credit row lock

T4: Cart B acquires credit row lock
    └─ Reads headroom: 40 available, 0 reserved (Cart A's reservation deleted), 40 effective
    └─ Payment succeeds
    └─ Attempts decrement: 60 units from 40 available
    └─ WHERE clause: availableAmount >= 60 → FALSE (40 < 60)
    └─ Zero rows updated
    └─ Throws ConflictException: "Insufficient credits..."
```

**Result**: Cart A succeeds (40 units left), Cart B fails. Total decremented ≤ 100. ✓

### Scenario 2: Reservation Expiry During Checkout

**Initial State**:
- Cart has reserved 60 units
- 5-minute reservation is about to expire

**Timeline**:

```
T1: confirmPurchase() enters Serializable transaction
    └─ Locks credit row
    └─ Checks: are reservations for this cart still valid?
       WHERE cartId = cart_id AND expiresAt > NOW() → 1 row found
    └─ All checks pass, payment succeeds

T2: (Concurrently, cron job runs releaseExpiredReservations)
    └─ Attempts to lock credit row → BLOCKS (confirmPurchase holds it)

T3: confirmPurchase decrements and commits
    └─ Releases credit row lock

T4: Cron job acquires credit row lock
    └─ Re-fetches expired reservations under lock
    └─ Finds nothing (Cart's reservation already deleted in step T3)
    └─ Completes cleanly
```

**Alternate Timeline** (if expiry happens first):

```
T1: Cron job releaseExpiredReservations() runs
    └─ Locks credit row
    └─ Finds 1 expired reservation
    └─ Deletes it

T2: confirmPurchase() enters Serializable transaction
    └─ Attempts to lock credit row → BLOCKS (cron job holds it)

T3: Cron job commits and releases lock

T4: confirmPurchase acquires credit row lock
    └─ Checks: are reservations still valid?
       WHERE cartId = cart_id AND expiresAt > NOW() → 0 rows found
    └─ Throws BadRequestException: "Reservation expired"
    └─ Order marked as failed
    └─ Reservations released
```

**Result**: No overselling occurs. Expired reservations are always detected. ✓

### Scenario 3: Rapid-Fire Concurrent Orders (5 × 25 units, 100 available)

**Initial State**: 100 units available

**Timeline**:

```
T0: All 5 orders call confirmPurchase() nearly simultaneously

T1: Order 1 acquires credit lock → calculates effective availability → passes payment
T2: Order 2 queued on credit lock
T3: Order 3 queued on credit lock
T4: Order 4 queued on credit lock
T5: Order 5 queued on credit lock

T6: Order 1 decrements 25 from 100 → 75 left, releases lock
T7: Order 2 acquires lock → calculates availability 75 → passes payment
T8: Order 2 decrements 25 from 75 → 50 left, releases lock

T9: Order 3 acquires lock → calculates availability 50 → passes payment
T10: Order 3 decrements 25 from 50 → 25 left, releases lock

T11: Order 4 acquires lock → calculates availability 25 → passes payment
T12: Order 4 decrements 25 from 25 → 0 left, releases lock

T13: Order 5 acquires lock → calculates availability 0 → payment may pass
T14: Order 5 attempts to decrement 25 from 0
     WHERE availableAmount >= 25 → FALSE
     Zero rows updated
     Throws ConflictException

Final State: 0 units left, 4 orders succeeded, 1 rejected
```

**Result**: Only 4 orders succeed, totaling 100 units. The 5th is cleanly rejected. ✓

## Concurrency Guarantees

### Guarantee 1: No Overselling

**Claim**: No combination of concurrent confirmPurchase calls can together decrement more than the credit's initial availableAmount.

**Proof**:
- All confirmPurchase operations serialize on the credit row lock (Serializable isolation + FOR UPDATE)
- Each operation re-checks availability under the lock before decrementing
- Each decrement is guarded by `WHERE availableAmount >= amount`
- If a decrement would exceed the floor, the update is rejected
- Therefore, total decrements cannot exceed initial amount

### Guarantee 2: Non-Negative Availability

**Claim**: availableAmount ≥ 0 always, guaranteed by application logic and database constraint.

**Proof**:
- Application: Floor guard prevents decrement if it would go negative
- Database: CHECK constraint prevents any operation from storing negative value
- Even if both fail, constraint violation is caught at the database layer

### Guarantee 3: Reservation Consistency

**Claim**: Active reservations are never counted twice, and stale reservations never cause incorrect calculations.

**Proof**:
- Reservation reads happen under credit row locks
- releaseExpiredReservations also uses row locks on the same lock path
- Both operations run in Serializable transactions
- Therefore, expiry cleanup and checkout confirm can never interleave

### Guarantee 4: Atomic Order Confirmation

**Claim**: Either an entire order confirms (payment + decrement + audit) or none of it does. No partial states.

**Proof**:
- confirmPurchase wraps payment processing and availability decrement in a single Serializable transaction
- If any step fails, the entire transaction rolls back
- Reservation expiry check happens inside the same transaction
- Therefore, confirmation is all-or-nothing

### Guarantee 5: Clear Failure Modes

**Claim**: When an order fails due to insufficient credits, the reason is clearly logged and distinguishable from other failures.

**Proof**:
- AvailabilityService.decrementWithin() logs a structured warning with category "oversell_prevention_rejection" when the floor guard update affects zero rows
- This log includes creditId, requested amount, available amount, and reservations
- Different failure types (payment declined, reservation expired) have separate code paths and logs
- Oversell rejections are unambiguous in logs and metrics

## Implementation Details

### Key Code Paths

1. **Reservation Phase** (`ReservationService.reserveCredits`):
   - Uses Serializable transaction
   - Locks credit row
   - Calls `assertAvailableWithin()` to verify headroom
   - Creates or updates CreditReservation
   - Logs movement on CreditAvailabilityLog

2. **Checkout Phase** (`CheckoutService.confirmPurchase`):
   - Advisory re-check (fast fail before payment)
   - Process payment (outside transaction)
   - Serializable transaction:
     - Check reservation expiry
     - Call `decrementWithin()` for each item
       - Locks credit row
       - Calls `assertAvailableWithin()`
       - Executes guarded UPDATE
       - Logs movement
     - Clear cart and reservations
   - Post-purchase triggers

3. **Expiry Cleanup** (`ReservationService.releaseExpiredReservations`):
   - Cron job runs every 5 minutes
   - Groups reservations by creditId
   - For each creditId:
     - Serializable transaction
     - Locks credit row
     - Re-fetches expired under lock
     - Deletes stale ones
     - Logs releases

### Configuration

- **Isolation Level**: `Serializable` (enforced by `AvailabilityService.runSerializable()`)
- **Lock Timeout**: 15 seconds (prevents deadlock on slow clients)
- **Reservation Duration**: 15 minutes (configurable via `RESERVATION_MINUTES`)
- **Expiry Check Frequency**: Every 5 minutes (cron job)

### Monitoring and Logging

All oversell prevention events are logged with:
- **Category**: `oversell_prevention_rejection`
- **Structured Fields**: creditId, projectName, changeType, requested/available amounts, reservations, reason, actor
- **Level**: WARNING (not ERROR, since rejection is expected behavior)
- **Aggregation**: Use log aggregation to track rejection rates per credit

### Testing

Comprehensive concurrency tests in `test/checkout-concurrency.e2e-spec.ts`:
- Two concurrent purchases exceeding available amount
- Rapid-fire (5×) concurrent attempts with limited inventory
- Verification of floor constraint (availableAmount ≥ 0)
- Database CHECK constraint integrity
- Reservation-confirmation interaction

## Migration Path

The CHECK constraint was added in migration `20260829120000_add_credit_availability_floor_constraint`, which:
1. Adds the CHECK constraint to the Credit table
2. Repairs any existing data with negative availableAmount (sets to 0)
3. Is non-blocking and backward-compatible

## Future Enhancements

1. **Metrics**: Emit metrics for:
   - Oversell rejection rate per credit
   - Payment-to-confirm latency
   - Reservation expiry rate

2. **Alerts**: Set up alerts for:
   - High oversell rejection rate (indicates inventory misconfiguration)
   - Frequent reservation expiries (indicates reservation timeout too short)

3. **Distributed Tracing**: Add trace IDs to follow an order through all stages (checkout → payment → confirm → post-purchase)

4. **Read Replicas**: For reporting queries only; all writes go through primary with Serializable isolation

## References

- PostgreSQL Concurrency Control: https://www.postgresql.org/docs/current/transaction-iso.html
- Prisma Transactions: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
- Row-Level Locking: https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-DOWN

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-29  
**Authors**: Platform Team  
**Status**: Implemented
