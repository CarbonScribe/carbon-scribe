-- Migration: add credit_availability_logs table
-- NOTE: review before applying in production

CREATE TABLE IF NOT EXISTS credit_availability_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "creditId" TEXT NOT NULL,
  "changedBy" TEXT,
  "changeType" TEXT NOT NULL,
  amount INTEGER NOT NULL,
  "previousAmount" INTEGER NOT NULL,
  "newAmount" INTEGER NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE credit_availability_logs
  ADD CONSTRAINT fk_credit
    FOREIGN KEY ("creditId") REFERENCES "Credit"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_credit_availability_logs_creditid ON credit_availability_logs ("creditId");
CREATE INDEX IF NOT EXISTS idx_credit_availability_logs_createdat ON credit_availability_logs ("createdAt");
