-- CreateTable
CREATE TABLE "RetirementSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "creditSelection" TEXT NOT NULL,
    "creditIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "frequency" TEXT NOT NULL,
    "interval" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunDate" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "notifyBefore" INTEGER,
    "notifyAfter" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleExecution" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "executedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "amountRetired" INTEGER,
    "retirementIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRetirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "completedItems" INTEGER NOT NULL,
    "failedItems" INTEGER NOT NULL,
    "retirementIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "errorLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchRetirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetirementSchedule_companyId_idx" ON "RetirementSchedule"("companyId");

-- CreateIndex
CREATE INDEX "RetirementSchedule_nextRunDate_idx" ON "RetirementSchedule"("nextRunDate");

-- CreateIndex
CREATE INDEX "RetirementSchedule_isActive_idx" ON "RetirementSchedule"("isActive");

-- CreateIndex
CREATE INDEX "RetirementSchedule_frequency_idx" ON "RetirementSchedule"("frequency");

-- CreateIndex
CREATE INDEX "ScheduleExecution_scheduleId_idx" ON "ScheduleExecution"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleExecution_status_idx" ON "ScheduleExecution"("status");

-- CreateIndex
CREATE INDEX "ScheduleExecution_scheduledDate_idx" ON "ScheduleExecution"("scheduledDate");

-- CreateIndex
CREATE INDEX "BatchRetirement_companyId_idx" ON "BatchRetirement"("companyId");

-- CreateIndex
CREATE INDEX "BatchRetirement_status_idx" ON "BatchRetirement"("status");

-- AddForeignKey
ALTER TABLE "RetirementSchedule" ADD CONSTRAINT "RetirementSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleExecution" ADD CONSTRAINT "ScheduleExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RetirementSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRetirement" ADD CONSTRAINT "BatchRetirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
