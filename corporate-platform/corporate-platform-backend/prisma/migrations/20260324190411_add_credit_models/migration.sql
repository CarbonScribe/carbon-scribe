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
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_projectId_fkey";

-- DropIndex
DROP INDEX "Credit_featured_idx";

-- DropIndex
DROP INDEX "Credit_projectId_idx";

-- DropIndex
DROP INDEX "Credit_purchaseCount_idx";

-- DropIndex
DROP INDEX "Credit_searchVector_idx";

-- DropIndex
DROP INDEX "Credit_viewCount_idx";

-- DropIndex
DROP INDEX "projects_companyId_idx";

-- AlterTable
ALTER TABLE "Credit" DROP COLUMN "available",
DROP COLUMN "price",
DROP COLUMN "standard",
DROP COLUMN "vintageYear",
ADD COLUMN     "additionalityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "assetCode" TEXT,
ADD COLUMN     "availableAmount" INTEGER NOT NULL,
ADD COLUMN     "cobenefitsScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "dynamicScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "issuer" TEXT,
ADD COLUMN     "lastVerification" TIMESTAMP(3),
ADD COLUMN     "leakageScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "permanenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pricePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'available',
ADD COLUMN     "transparencyScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verificationScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verificationStandard" TEXT,
ADD COLUMN     "vintage" INTEGER,
ALTER COLUMN "projectId" SET NOT NULL,
DROP COLUMN "sdgs",
ADD COLUMN     "sdgs" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "standard",
ADD COLUMN     "availableCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "avgScore" DOUBLE PRECISION,
ADD COLUMN     "communities" INTEGER,
ADD COLUMN     "developer" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "lastVerification" TIMESTAMP(3),
ADD COLUMN     "region" TEXT,
ADD COLUMN     "sdgs" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "totalCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "verificationStandard" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE INDEX "Credit_status_idx" ON "Credit"("status");

-- CreateIndex
CREATE INDEX "Credit_country_idx" ON "Credit"("country");

-- CreateIndex
CREATE INDEX "Credit_methodology_idx" ON "Credit"("methodology");

-- CreateIndex
CREATE INDEX "Credit_vintage_idx" ON "Credit"("vintage");

-- CreateIndex
CREATE INDEX "Credit_dynamicScore_idx" ON "Credit"("dynamicScore");

-- CreateIndex
CREATE INDEX "projects_country_idx" ON "projects"("country");

-- CreateIndex
CREATE INDEX "projects_type_idx" ON "projects"("type");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
