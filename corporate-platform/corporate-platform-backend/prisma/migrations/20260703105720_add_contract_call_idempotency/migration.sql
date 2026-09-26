/*
  Warnings:

  - A unique constraint covering the columns `[companyId,idempotencyKey]` on the table `IpfsDocument` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotency_key]` on the table `contract_calls` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deduplication_key]` on the table `contract_calls` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `contract_calls` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "IpfsDocument" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "contract_calls" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deduplication_key" TEXT,
ADD COLUMN     "duplicate_reason" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastRetryAt" TIMESTAMP(3),
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "original_call_id" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workflow_id" TEXT;

-- CreateTable
CREATE TABLE "retirement_audit_hash_anchors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "token_id" INTEGER NOT NULL,
    "audit_event_id" TEXT,
    "audit_hash" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "on_chain_tx_hash" TEXT,
    "anchor_status" TEXT NOT NULL DEFAULT 'PENDING',
    "anchored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "retirement_audit_hash_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retirement_audit_hash_anchors_company_id_idx" ON "retirement_audit_hash_anchors"("company_id");

-- CreateIndex
CREATE INDEX "retirement_audit_hash_anchors_token_id_idx" ON "retirement_audit_hash_anchors"("token_id");

-- CreateIndex
CREATE INDEX "retirement_audit_hash_anchors_anchor_status_idx" ON "retirement_audit_hash_anchors"("anchor_status");

-- CreateIndex
CREATE UNIQUE INDEX "retirement_audit_hash_anchors_token_id_audit_hash_key" ON "retirement_audit_hash_anchors"("token_id", "audit_hash");

-- CreateIndex
CREATE UNIQUE INDEX "IpfsDocument_companyId_idempotencyKey_key" ON "IpfsDocument"("companyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "contract_calls_idempotency_key_key" ON "contract_calls"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_calls_deduplication_key_key" ON "contract_calls"("deduplication_key");

-- CreateIndex
CREATE INDEX "contract_calls_workflow_id_idx" ON "contract_calls"("workflow_id");

-- CreateIndex
CREATE INDEX "contract_calls_idempotency_key_idx" ON "contract_calls"("idempotency_key");

-- CreateIndex
CREATE INDEX "contract_calls_deduplication_key_idx" ON "contract_calls"("deduplication_key");

-- CreateIndex
CREATE INDEX "contract_calls_status_nextRetryAt_idx" ON "contract_calls"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "contract_calls_companyId_workflow_id_idx" ON "contract_calls"("companyId", "workflow_id");

-- AddForeignKey
ALTER TABLE "contract_calls" ADD CONSTRAINT "contract_calls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
