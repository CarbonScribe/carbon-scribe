-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_ownership_history" (
    "id" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "companyId" TEXT,
    "previousOwner" TEXT NOT NULL,
    "newOwner" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "ledgerSequence" INTEGER NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_current_owners" (
    "id" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_current_owners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_ownership_history_tokenId_idx" ON "credit_ownership_history"("tokenId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_ownership_history_newOwner_idx" ON "credit_ownership_history"("newOwner");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_ownership_history_transactionHash_idx" ON "credit_ownership_history"("transactionHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_ownership_history_timestamp_idx" ON "credit_ownership_history"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "credit_current_owners_tokenId_key" ON "credit_current_owners"("tokenId");
