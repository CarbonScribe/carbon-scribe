-- CORSIA compliance models

CREATE TABLE IF NOT EXISTS "flight_records" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "flightNumber" TEXT NOT NULL,
  "departureICAO" TEXT NOT NULL,
  "arrivalICAO" TEXT NOT NULL,
  "departureDate" TIMESTAMP(3) NOT NULL,
  "aircraftType" TEXT NOT NULL,
  "fuelBurn" DOUBLE PRECISION NOT NULL,
  "fuelType" TEXT NOT NULL,
  "distance" DOUBLE PRECISION NOT NULL,
  "passengerLoad" DOUBLE PRECISION,
  "cargoLoad" DOUBLE PRECISION,
  "co2Emissions" DOUBLE PRECISION NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "flight_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "corsia_compliance_years" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "baselineEmissions" DOUBLE PRECISION,
  "totalEmissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "offsetRequirement" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "offsetsRetired" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "complianceStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "reportSubmitted" TIMESTAMP(3),
  "verificationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "corsia_compliance_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "corsia_eligible_credits" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "retirementId" TEXT NOT NULL,
  "program" TEXT NOT NULL,
  "creditType" TEXT NOT NULL,
  "vintageYear" INTEGER NOT NULL,
  "eligible" BOOLEAN NOT NULL,
  "eligibilityMemo" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "corsia_eligible_credits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "flight_records_companyId_idx" ON "flight_records"("companyId");
CREATE INDEX IF NOT EXISTS "flight_records_companyId_departureDate_idx" ON "flight_records"("companyId", "departureDate");
CREATE INDEX IF NOT EXISTS "flight_records_flightNumber_idx" ON "flight_records"("flightNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "corsia_compliance_years_companyId_year_key" ON "corsia_compliance_years"("companyId", "year");
CREATE INDEX IF NOT EXISTS "corsia_compliance_years_companyId_idx" ON "corsia_compliance_years"("companyId");
CREATE INDEX IF NOT EXISTS "corsia_compliance_years_year_idx" ON "corsia_compliance_years"("year");

CREATE UNIQUE INDEX IF NOT EXISTS "corsia_eligible_credits_retirementId_key" ON "corsia_eligible_credits"("retirementId");
CREATE INDEX IF NOT EXISTS "corsia_eligible_credits_companyId_idx" ON "corsia_eligible_credits"("companyId");
CREATE INDEX IF NOT EXISTS "corsia_eligible_credits_companyId_eligible_idx" ON "corsia_eligible_credits"("companyId", "eligible");
CREATE INDEX IF NOT EXISTS "corsia_eligible_credits_vintageYear_idx" ON "corsia_eligible_credits"("vintageYear");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flight_records_companyId_fkey'
  ) THEN
    ALTER TABLE "flight_records"
      ADD CONSTRAINT "flight_records_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corsia_compliance_years_companyId_fkey'
  ) THEN
    ALTER TABLE "corsia_compliance_years"
      ADD CONSTRAINT "corsia_compliance_years_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corsia_eligible_credits_companyId_fkey'
  ) THEN
    ALTER TABLE "corsia_eligible_credits"
      ADD CONSTRAINT "corsia_eligible_credits_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corsia_eligible_credits_retirementId_fkey'
  ) THEN
    ALTER TABLE "corsia_eligible_credits"
      ADD CONSTRAINT "corsia_eligible_credits_retirementId_fkey"
      FOREIGN KEY ("retirementId") REFERENCES "Retirement"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
