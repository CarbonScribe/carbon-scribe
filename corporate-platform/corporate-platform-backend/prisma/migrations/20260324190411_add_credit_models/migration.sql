/*
  Warnings:

  - You are about to drop the column `available` on the `Credit` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Credit` table. All the data in the column will be lost.
  - You are about to drop the column `standard` on the `Credit` table. All the data in the column will be lost.
  - You are about to drop the column `vintageYear` on the `Credit` table. All the data in the column will be lost.
  - The `sdgs` column on the `Credit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `standard` on the `projects` table. All the data in the column will be lost.
  - Added the required column `availableAmount` to the `Credit` table without a default value. This is not possible if the table is not empty.
  - Made the column `projectId` on table `Credit` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `startDate` to the `projects` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT IF EXISTS "Credit_projectId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Credit_featured_idx";

-- DropIndex
DROP INDEX IF EXISTS "Credit_projectId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Credit_purchaseCount_idx";

-- DropIndex
DROP INDEX IF EXISTS "Credit_searchVector_idx";

-- DropIndex
DROP INDEX IF EXISTS "Credit_viewCount_idx";

-- DropIndex
DROP INDEX IF EXISTS "projects_companyId_idx";

-- AlterTable
ALTER TABLE "Credit" DROP COLUMN IF EXISTS "available",
DROP COLUMN IF EXISTS "price",
DROP COLUMN IF EXISTS "standard",
DROP COLUMN IF EXISTS "vintageYear",
ADD COLUMN IF NOT EXISTS     "additionalityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "assetCode" TEXT,
ADD COLUMN IF NOT EXISTS     "availableAmount" INTEGER NOT NULL,
ADD COLUMN IF NOT EXISTS     "cobenefitsScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "contractId" TEXT,
ADD COLUMN IF NOT EXISTS     "dynamicScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "issuer" TEXT,
ADD COLUMN IF NOT EXISTS     "lastVerification" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "leakageScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "permanenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "pricePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "status" TEXT NOT NULL DEFAULT 'available',
ADD COLUMN IF NOT EXISTS     "transparencyScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "verificationScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "verificationStandard" TEXT,
ADD COLUMN IF NOT EXISTS     "vintage" INTEGER,
ALTER COLUMN "projectId" SET NOT NULL,
DROP COLUMN IF EXISTS "sdgs",
ADD COLUMN IF NOT EXISTS     "sdgs" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "projects" DROP COLUMN IF EXISTS "standard",
ADD COLUMN IF NOT EXISTS     "availableCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "avgScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS     "communities" INTEGER,
ADD COLUMN IF NOT EXISTS     "developer" TEXT,
ADD COLUMN IF NOT EXISTS     "endDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "lastVerification" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "region" TEXT,
ADD COLUMN IF NOT EXISTS     "sdgs" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN IF NOT EXISTS     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN IF NOT EXISTS     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS     "totalCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "type" TEXT,
ADD COLUMN IF NOT EXISTS     "verificationStandard" TEXT,
ADD COLUMN IF NOT EXISTS     "website" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_status_idx" ON "Credit"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_country_idx" ON "Credit"("country");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_methodology_idx" ON "Credit"("methodology");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_vintage_idx" ON "Credit"("vintage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Credit_dynamicScore_idx" ON "Credit"("dynamicScore");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_country_idx" ON "projects"("country");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_type_idx" ON "projects"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
