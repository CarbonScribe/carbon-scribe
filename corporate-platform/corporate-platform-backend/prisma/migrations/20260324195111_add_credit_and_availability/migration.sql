/*
  Warnings:

  - Made the column `createdAt` on table `credit_availability_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "credit_availability_logs" DROP CONSTRAINT "fk_credit";

-- AlterTable
ALTER TABLE "credit_availability_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "credit_availability_logs" ADD CONSTRAINT "credit_availability_logs_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_credit_availability_logs_createdat" RENAME TO "credit_availability_logs_createdAt_idx";

-- RenameIndex
ALTER INDEX "idx_credit_availability_logs_creditid" RENAME TO "credit_availability_logs_creditId_idx";
