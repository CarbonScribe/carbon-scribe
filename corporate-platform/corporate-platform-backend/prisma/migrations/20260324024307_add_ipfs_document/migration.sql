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
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_cartId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropIndex
DROP INDEX "BatchRetirement_status_idx";

-- DropIndex
DROP INDEX "Cart_sessionId_idx";

-- DropIndex
DROP INDEX "Cart_sessionId_key";

-- DropIndex
DROP INDEX "Order_cartId_key";

-- DropIndex
DROP INDEX "Order_orderNumber_idx";

-- DropIndex
DROP INDEX "RetirementSchedule_frequency_idx";

-- DropIndex
DROP INDEX "RetirementSchedule_isActive_idx";

-- DropIndex
DROP INDEX "RetirementSchedule_nextRunDate_idx";

-- DropIndex
DROP INDEX "ScheduleExecution_scheduledDate_idx";

-- DropIndex
DROP INDEX "portfolios_asOfDate_idx";

-- AlterTable
ALTER TABLE "BatchRetirement" DROP COLUMN "updatedAt",
ADD COLUMN     "executionId" TEXT,
ADD COLUMN     "scheduleId" TEXT,
ALTER COLUMN "retirementIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "quantity" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET NOT NULL;

-- AlterTable
ALTER TABLE "RetirementSchedule" DROP COLUMN "createdBy",
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "creditIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduleExecution" DROP COLUMN "updatedAt",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "runAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "scheduledDate" DROP NOT NULL,
ALTER COLUMN "retirementIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "portfolios" DROP COLUMN "asOfDate",
DROP COLUMN "name",
DROP COLUMN "totalCredits",
ADD COLUMN     "avgPricePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "avgVintage" DOUBLE PRECISION,
ADD COLUMN     "currentBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diversificationScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netZeroProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "netZeroTarget" INTEGER,
ADD COLUMN     "riskRating" TEXT NOT NULL DEFAULT 'Low',
ADD COLUMN     "scope3Coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "totalRetired" SET DEFAULT 0,
ALTER COLUMN "totalRetired" SET DATA TYPE INTEGER;

-- CreateTable
CREATE TABLE "retirement_targets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "retirement_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpWhitelist" (
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
CREATE TABLE "AuditLog" (
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
CREATE TABLE "Auction" (
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
CREATE TABLE "Bid" (
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
CREATE TABLE "OrderAuditLog" (
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
CREATE TABLE "CreditReservation" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
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
CREATE TABLE "portfolio_snapshots" (
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
CREATE TABLE "IpfsDocument" (
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
CREATE UNIQUE INDEX "retirement_targets_companyId_year_month_key" ON "retirement_targets"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "IpWhitelist_companyId_idx" ON "IpWhitelist"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IpWhitelist_companyId_cidr_key" ON "IpWhitelist"("companyId", "cidr");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "Auction_creditId_idx" ON "Auction"("creditId");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "Bid_auctionId_idx" ON "Bid"("auctionId");

-- CreateIndex
CREATE INDEX "Bid_companyId_idx" ON "Bid"("companyId");

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_orderId_idx" ON "OrderAuditLog"("orderId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CreditReservation_creditId_idx" ON "CreditReservation"("creditId");

-- CreateIndex
CREATE INDEX "CreditReservation_expiresAt_idx" ON "CreditReservation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReservation_cartId_creditId_key" ON "CreditReservation"("cartId", "creditId");

-- CreateIndex
CREATE INDEX "portfolio_holdings_portfolioId_idx" ON "portfolio_holdings"("portfolioId");

-- CreateIndex
CREATE INDEX "portfolio_holdings_creditId_idx" ON "portfolio_holdings"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_holdings_portfolioId_creditId_key" ON "portfolio_holdings"("portfolioId", "creditId");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_portfolioId_snapshotDate_idx" ON "portfolio_snapshots"("portfolioId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "IpfsDocument_ipfsCid_key" ON "IpfsDocument"("ipfsCid");

-- CreateIndex
CREATE INDEX "IpfsDocument_companyId_idx" ON "IpfsDocument"("companyId");

-- CreateIndex
CREATE INDEX "IpfsDocument_referenceId_idx" ON "IpfsDocument"("referenceId");

-- CreateIndex
CREATE INDEX "BatchRetirement_scheduleId_idx" ON "BatchRetirement"("scheduleId");

-- CreateIndex
CREATE INDEX "BatchRetirement_executionId_idx" ON "BatchRetirement"("executionId");

-- CreateIndex
CREATE INDEX "CartItem_creditId_idx" ON "CartItem"("creditId");

-- CreateIndex
CREATE INDEX "Credit_searchVector_idx" ON "Credit"("searchVector");

-- CreateIndex
CREATE INDEX "Credit_featured_idx" ON "Credit"("featured");

-- CreateIndex
CREATE INDEX "Credit_viewCount_idx" ON "Credit"("viewCount");

-- CreateIndex
CREATE INDEX "Credit_purchaseCount_idx" ON "Credit"("purchaseCount");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderItem_creditId_idx" ON "OrderItem"("creditId");

-- CreateIndex
CREATE INDEX "Retirement_userId_idx" ON "Retirement"("userId");

-- CreateIndex
CREATE INDEX "RetirementSchedule_userId_idx" ON "RetirementSchedule"("userId");

-- CreateIndex
CREATE INDEX "RetirementSchedule_isActive_nextRunDate_idx" ON "RetirementSchedule"("isActive", "nextRunDate");

-- CreateIndex
CREATE INDEX "ScheduleExecution_runAt_idx" ON "ScheduleExecution"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_companyId_key" ON "portfolios"("companyId");

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
