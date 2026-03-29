/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `BatchRetirement` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `RetirementSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ScheduleExecution` table. All the data in the column will be lost.
  - You are about to drop the column `asOfDate` on the `portfolios` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `portfolios` table. All the data in the column will be lost.
  - You are about to drop the column `totalCredits` on the `portfolios` table. All the data in the column will be lost.
  - You are about to alter the column `totalRetired` on the `portfolios` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - A unique constraint covering the columns `[companyId]` on the table `portfolios` will be added. If there are existing duplicate values, this will fail.
  - Made the column `paymentMethod` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `userId` to the `RetirementSchedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `runAt` to the `ScheduleExecution` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "BatchRetirement_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "Cart_sessionId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Cart_sessionId_key";

-- DropIndex
DROP INDEX IF EXISTS "Order_cartId_key";

-- DropIndex
DROP INDEX IF EXISTS "Order_orderNumber_idx";

-- DropIndex
DROP INDEX IF EXISTS "RetirementSchedule_frequency_idx";

-- DropIndex
DROP INDEX IF EXISTS "RetirementSchedule_isActive_idx";

-- DropIndex
DROP INDEX IF EXISTS "RetirementSchedule_nextRunDate_idx";

-- DropIndex
DROP INDEX IF EXISTS "ScheduleExecution_scheduledDate_idx";

-- DropIndex
DROP INDEX IF EXISTS "portfolios_asOfDate_idx";

-- AlterTable
ALTER TABLE "BatchRetirement" DROP COLUMN IF EXISTS "updatedAt",
ADD COLUMN IF NOT EXISTS     "executionId" TEXT,
ADD COLUMN IF NOT EXISTS     "scheduleId" TEXT,
ALTER COLUMN "retirementIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "quantity" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET NOT NULL;

-- AlterTable
ALTER TABLE "RetirementSchedule" DROP COLUMN IF EXISTS "createdBy",
ADD COLUMN IF NOT EXISTS     "timezone" TEXT,
ADD COLUMN IF NOT EXISTS     "userId" TEXT NOT NULL,
ALTER COLUMN "creditIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduleExecution" DROP COLUMN IF EXISTS "updatedAt",
ADD COLUMN IF NOT EXISTS     "completedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "error" TEXT,
ADD COLUMN IF NOT EXISTS     "runAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "scheduledDate" DROP NOT NULL,
ALTER COLUMN "retirementIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "portfolios" DROP COLUMN IF EXISTS "asOfDate",
DROP COLUMN IF EXISTS "name",
DROP COLUMN IF EXISTS "totalCredits",
ADD COLUMN IF NOT EXISTS     "avgPricePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "avgVintage" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS     "currentBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "diversificationScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "netZeroProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "netZeroTarget" INTEGER,
ADD COLUMN IF NOT EXISTS     "riskRating" TEXT NOT NULL DEFAULT 'Low',
ADD COLUMN IF NOT EXISTS     "scope3Coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "totalRetired" SET DEFAULT 0,
ALTER COLUMN "totalRetired" SET DATA TYPE INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "retirement_targets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "retirement_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IpWhitelist" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "resource" TEXT,
    "method" TEXT,
    "details" JSONB,
    "oldValue" JSONB,
    "newValue" JSONB,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Auction" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "startPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "floorPrice" DOUBLE PRECISION NOT NULL,
    "priceDecrement" DOUBLE PRECISION NOT NULL,
    "decrementInterval" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "lastPriceUpdate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "winnerId" TEXT,
    "finalPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bidPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderAuditLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditReservation" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "portfolio_holdings" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "totalRetired" INTEGER NOT NULL,
    "currentBalance" INTEGER NOT NULL,
    "methodologyDistribution" JSONB NOT NULL,
    "geographicDistribution" JSONB NOT NULL,
    "sdgDistribution" JSONB NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IpfsDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "ipfsGateway" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT true,
    "pinnedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IpfsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "retirement_targets_companyId_year_month_key" ON "retirement_targets"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IpWhitelist_companyId_idx" ON "IpWhitelist"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IpWhitelist_companyId_cidr_key" ON "IpWhitelist"("companyId", "cidr");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Auction_creditId_idx" ON "Auction"("creditId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bid_auctionId_idx" ON "Bid"("auctionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bid_companyId_idx" ON "Bid"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderAuditLog_orderId_idx" ON "OrderAuditLog"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CreditReservation_creditId_idx" ON "CreditReservation"("creditId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CreditReservation_expiresAt_idx" ON "CreditReservation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CreditReservation_cartId_creditId_key" ON "CreditReservation"("cartId", "creditId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "portfolio_holdings_portfolioId_idx" ON "portfolio_holdings"("portfolioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "portfolio_holdings_creditId_idx" ON "portfolio_holdings"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_holdings_portfolioId_creditId_key" ON "portfolio_holdings"("portfolioId", "creditId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "portfolio_snapshots_portfolioId_snapshotDate_idx" ON "portfolio_snapshots"("portfolioId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IpfsDocument_ipfsCid_key" ON "IpfsDocument"("ipfsCid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IpfsDocument_companyId_idx" ON "IpfsDocument"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IpfsDocument_referenceId_idx" ON "IpfsDocument"("referenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BatchRetirement_scheduleId_idx" ON "BatchRetirement"("scheduleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BatchRetirement_executionId_idx" ON "BatchRetirement"("executionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CartItem_creditId_idx" ON "CartItem"("creditId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_searchVector_idx" ON "Credit"("searchVector");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_featured_idx" ON "Credit"("featured");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_viewCount_idx" ON "Credit"("viewCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_purchaseCount_idx" ON "Credit"("purchaseCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_creditId_idx" ON "OrderItem"("creditId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Retirement_userId_idx" ON "Retirement"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetirementSchedule_userId_idx" ON "RetirementSchedule"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetirementSchedule_isActive_nextRunDate_idx" ON "RetirementSchedule"("isActive", "nextRunDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduleExecution_runAt_idx" ON "ScheduleExecution"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "portfolios_companyId_key" ON "portfolios"("companyId");

-- AddForeignKey
ALTER TABLE "retirement_targets" ADD CONSTRAINT "retirement_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpWhitelist" ADD CONSTRAINT "IpWhitelist_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementSchedule" ADD CONSTRAINT "RetirementSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRetirement" ADD CONSTRAINT "BatchRetirement_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RetirementSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRetirement" ADD CONSTRAINT "BatchRetirement_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ScheduleExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
