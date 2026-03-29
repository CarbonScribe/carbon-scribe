-- Tenant schema hardening

-- Credit: add direct tenant ownership for stronger isolation at row level
ALTER TABLE "Credit"
ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Backfill from owning project when available
UPDATE "Credit" c
SET "companyId" = p."companyId"
FROM "projects" p
WHERE c."projectId" = p."id"
  AND c."companyId" IS NULL
  AND p."companyId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Credit_companyId_idx" ON "Credit"("companyId");
CREATE INDEX IF NOT EXISTS "Credit_companyId_status_idx" ON "Credit"("companyId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Credit_companyId_fkey'
  ) THEN
    ALTER TABLE "Credit"
    ADD CONSTRAINT "Credit_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- IpfsDocument: enforce company FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IpfsDocument_companyId_fkey'
  ) THEN
    ALTER TABLE "IpfsDocument"
    ADD CONSTRAINT "IpfsDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- transaction_confirmations: enforce company FK + index (guarded: table may not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction_confirmations' AND table_schema = 'public'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'transaction_confirmations_companyId_idx') THEN
      EXECUTE 'CREATE INDEX "transaction_confirmations_companyId_idx" ON "transaction_confirmations"("companyId")';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'transaction_confirmations_companyId_fkey'
    ) THEN
      ALTER TABLE "transaction_confirmations"
      ADD CONSTRAINT "transaction_confirmations_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END
$$;
