-- CreateTable
CREATE TABLE "certificate_anchor_failures" (
    "id" TEXT NOT NULL,
    "retirementId" TEXT,
    "companyId" TEXT,
    "certificateData" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "nextRetryAt" TIMESTAMP(3),
    "resolvedCid" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "certificate_anchor_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certificate_anchor_failures_status_idx" ON "certificate_anchor_failures"("status");

-- CreateIndex
CREATE INDEX "certificate_anchor_failures_retirementId_idx" ON "certificate_anchor_failures"("retirementId");

-- CreateIndex
CREATE INDEX "certificate_anchor_failures_companyId_idx" ON "certificate_anchor_failures"("companyId");

-- CreateIndex
CREATE INDEX "certificate_anchor_failures_nextRetryAt_idx" ON "certificate_anchor_failures"("nextRetryAt");
