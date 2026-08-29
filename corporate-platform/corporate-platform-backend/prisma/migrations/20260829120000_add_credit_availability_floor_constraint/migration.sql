-- Add CHECK constraint to enforce availableAmount >= 0
-- This prevents database-level corruption of credit inventory
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_availableAmount_floor" CHECK ("availableAmount" >= 0);

-- Update any existing negative values to 0 (data repair)
UPDATE "Credit" SET "availableAmount" = 0 WHERE "availableAmount" < 0;
