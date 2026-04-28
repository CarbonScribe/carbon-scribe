-- CreateTable
CREATE TABLE "contract_calls" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "methodName" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "contract_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retirement_verifications" (
    "id" TEXT NOT NULL,
    "retirementId" TEXT NOT NULL,
    "tokenIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "amount" INTEGER NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proof" JSONB,

    CONSTRAINT "retirement_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_calls_transactionHash_key" ON "contract_calls"("transactionHash");

-- CreateIndex
CREATE INDEX "contract_calls_companyId_idx" ON "contract_calls"("companyId");

-- CreateIndex
CREATE INDEX "contract_calls_contractId_idx" ON "contract_calls"("contractId");

-- CreateIndex
CREATE INDEX "contract_calls_status_idx" ON "contract_calls"("status");

-- CreateIndex
CREATE INDEX "contract_calls_submittedAt_idx" ON "contract_calls"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "retirement_verifications_transactionHash_key" ON "retirement_verifications"("transactionHash");

-- CreateIndex
CREATE INDEX "retirement_verifications_retirementId_idx" ON "retirement_verifications"("retirementId");

-- CreateIndex
CREATE INDEX "retirement_verifications_verifiedAt_idx" ON "retirement_verifications"("verifiedAt");
