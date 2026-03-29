-- Methodology sync model hardening for on-chain metadata

CREATE TABLE IF NOT EXISTS "frameworks" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "requirements" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "frameworks_code_key" ON "frameworks"("code");

CREATE TABLE IF NOT EXISTS "synced_methodologies" (
  "id" TEXT NOT NULL,
  "tokenId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "registry" TEXT NOT NULL,
  "registryLink" TEXT NOT NULL,
  "issuingAuthority" TEXT NOT NULL,
  "ipfsCid" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncedFromBlock" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "synced_methodologies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "synced_methodologies_tokenId_key" ON "synced_methodologies"("tokenId");

ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "version" TEXT;
ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "registryLink" TEXT;
ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "issuingAuthority" TEXT;
ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "ipfsCid" TEXT;
ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "synced_methodologies" ADD COLUMN IF NOT EXISTS "syncedFromBlock" INTEGER NOT NULL DEFAULT 0;

DO $$
DECLARE
  has_authority_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'synced_methodologies'
      AND column_name = 'authority'
  ) INTO has_authority_column;

  IF has_authority_column THEN
    EXECUTE '
      UPDATE "synced_methodologies"
      SET
        "version" = COALESCE(NULLIF("version", ''''), ''UNKNOWN''),
        "registry" = COALESCE(NULLIF("registry", ''''), ''UNKNOWN''),
        "registryLink" = COALESCE(NULLIF("registryLink", ''''), ''''),
        "issuingAuthority" = COALESCE(NULLIF("issuingAuthority", ''''), NULLIF("authority", ''''), ''''),
        "lastSyncedAt" = COALESCE("lastSyncedAt", CURRENT_TIMESTAMP),
        "syncedFromBlock" = COALESCE("syncedFromBlock", 0)
    ';
  ELSE
    UPDATE "synced_methodologies"
    SET
      "version" = COALESCE(NULLIF("version", ''), 'UNKNOWN'),
      "registry" = COALESCE(NULLIF("registry", ''), 'UNKNOWN'),
      "registryLink" = COALESCE(NULLIF("registryLink", ''), ''),
      "issuingAuthority" = COALESCE(NULLIF("issuingAuthority", ''), ''),
      "lastSyncedAt" = COALESCE("lastSyncedAt", CURRENT_TIMESTAMP),
      "syncedFromBlock" = COALESCE("syncedFromBlock", 0);
  END IF;
END
$$;

ALTER TABLE "synced_methodologies" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE "synced_methodologies" ALTER COLUMN "registry" SET NOT NULL;
ALTER TABLE "synced_methodologies" ALTER COLUMN "registryLink" SET NOT NULL;
ALTER TABLE "synced_methodologies" ALTER COLUMN "issuingAuthority" SET NOT NULL;

ALTER TABLE "synced_methodologies" DROP COLUMN IF EXISTS "description";
ALTER TABLE "synced_methodologies" DROP COLUMN IF EXISTS "category";
ALTER TABLE "synced_methodologies" DROP COLUMN IF EXISTS "authority";

CREATE TABLE IF NOT EXISTS "framework_methodology_mappings" (
  "id" TEXT NOT NULL,
  "frameworkId" TEXT NOT NULL,
  "methodologyId" TEXT NOT NULL,
  "methodologyTokenId" INTEGER NOT NULL,
  "requirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "mappingType" TEXT NOT NULL,
  "mappedBy" TEXT,
  "mappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  CONSTRAINT "framework_methodology_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "framework_methodology_mappings_frameworkId_methodologyId_key"
ON "framework_methodology_mappings"("frameworkId", "methodologyId");

CREATE INDEX IF NOT EXISTS "framework_methodology_mappings_methodologyTokenId_idx"
ON "framework_methodology_mappings"("methodologyTokenId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'framework_methodology_mappings_frameworkId_fkey'
  ) THEN
    ALTER TABLE "framework_methodology_mappings"
      ADD CONSTRAINT "framework_methodology_mappings_frameworkId_fkey"
      FOREIGN KEY ("frameworkId") REFERENCES "frameworks"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'framework_methodology_mappings_methodologyId_fkey'
  ) THEN
    ALTER TABLE "framework_methodology_mappings"
      ADD CONSTRAINT "framework_methodology_mappings_methodologyId_fkey"
      FOREIGN KEY ("methodologyId") REFERENCES "synced_methodologies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
