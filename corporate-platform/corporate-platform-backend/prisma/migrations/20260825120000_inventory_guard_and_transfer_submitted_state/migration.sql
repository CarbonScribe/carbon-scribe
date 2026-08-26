-- #516 — Defense-in-depth backstop for credit inventory.
--
-- Cart reservation, order checkout, and instant retirement now share one
-- lock-safe decrement path, but a database CHECK guarantees that no future
-- logic bug (or direct SQL) can drive availability below zero.

-- Clamp any rows that already went negative before the guard existed, so the
-- constraint can be validated.
UPDATE "Credit" SET "availableAmount" = 0 WHERE "availableAmount" < 0;

ALTER TABLE "Credit"
  DROP CONSTRAINT IF EXISTS "Credit_availableAmount_non_negative";

ALTER TABLE "Credit"
  ADD CONSTRAINT "Credit_availableAmount_non_negative"
  CHECK ("availableAmount" >= 0);

-- Reservations must also be positive quantities. Drop any degenerate holds
-- first so the constraint can be validated.
DELETE FROM "CreditReservation" WHERE "quantity" <= 0;

ALTER TABLE "CreditReservation"
  DROP CONSTRAINT IF EXISTS "CreditReservation_quantity_positive";

ALTER TABLE "CreditReservation"
  ADD CONSTRAINT "CreditReservation_quantity_positive"
  CHECK ("quantity" > 0);

-- Index supporting the reserved-headroom aggregate taken on every claim.
CREATE INDEX IF NOT EXISTS "CreditReservation_creditId_expiresAt_idx"
  ON "CreditReservation"("creditId", "expiresAt");

-- FE-069 — explicit on-chain confirmation states for credit transfers.
--
-- `submittedAt` records the moment a transfer was broadcast, so the UI can
-- render elapsed pending time and flag transfers stuck beyond a threshold.
-- Existing rows backfill from `initiatedAt`.
ALTER TABLE "CreditTransfer"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

UPDATE "CreditTransfer"
  SET "submittedAt" = "initiatedAt"
  WHERE "submittedAt" IS NULL;

-- #515 — the reconciliation sweep queries PENDING contract calls that are due;
-- it reuses the existing "contract_calls_status_nextRetryAt_idx" index.
