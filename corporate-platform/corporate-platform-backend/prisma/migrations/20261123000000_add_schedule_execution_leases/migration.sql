-- Execution leases for multi-instance scheduled retirement runs (#814).
-- AlterTable
ALTER TABLE "RetirementSchedule" ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT;

-- AlterTable
ALTER TABLE "ScheduleExecution" ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT;
