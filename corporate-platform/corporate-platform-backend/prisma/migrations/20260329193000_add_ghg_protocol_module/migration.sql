-- GHG Protocol accounting models

CREATE TABLE IF NOT EXISTS "emission_sources" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "scope" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "activityType" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "methodology" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "emission_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "emission_records" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "activity_value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "emission_factor" DOUBLE PRECISION NOT NULL,
  "factor_source" TEXT,
  "factor_region" TEXT,
  "co2e" DOUBLE PRECISION NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "emission_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "emission_factors" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "activity_type" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "co2e_per_unit" DOUBLE PRECISION NOT NULL,
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_to" TIMESTAMP(3),
  "region" TEXT NOT NULL,
  "methodology" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "emission_sources_companyId_idx" ON "emission_sources"("companyId");
CREATE INDEX IF NOT EXISTS "emission_sources_companyId_scope_idx" ON "emission_sources"("companyId", "scope");
CREATE INDEX IF NOT EXISTS "emission_sources_activityType_idx" ON "emission_sources"("activityType");

CREATE INDEX IF NOT EXISTS "emission_records_companyId_idx" ON "emission_records"("companyId");
CREATE INDEX IF NOT EXISTS "emission_records_source_id_idx" ON "emission_records"("source_id");
CREATE INDEX IF NOT EXISTS "emission_records_companyId_period_start_idx" ON "emission_records"("companyId", "period_start");
CREATE INDEX IF NOT EXISTS "emission_records_companyId_verified_idx" ON "emission_records"("companyId", "verified");

CREATE UNIQUE INDEX IF NOT EXISTS "emission_factors_source_activity_type_unit_region_valid_from_key"
  ON "emission_factors"("source", "activity_type", "unit", "region", "valid_from");
CREATE INDEX IF NOT EXISTS "emission_factors_activity_type_region_idx" ON "emission_factors"("activity_type", "region");
CREATE INDEX IF NOT EXISTS "emission_factors_valid_from_valid_to_idx" ON "emission_factors"("valid_from", "valid_to");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emission_sources_companyId_fkey'
  ) THEN
    ALTER TABLE "emission_sources"
      ADD CONSTRAINT "emission_sources_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emission_records_companyId_fkey'
  ) THEN
    ALTER TABLE "emission_records"
      ADD CONSTRAINT "emission_records_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emission_records_source_id_fkey'
  ) THEN
    ALTER TABLE "emission_records"
      ADD CONSTRAINT "emission_records_source_id_fkey"
      FOREIGN KEY ("source_id") REFERENCES "emission_sources"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
