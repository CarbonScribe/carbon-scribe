-- AlterTable
ALTER TABLE "framework_methodology_mappings" ALTER COLUMN "requirementIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "retirement_verifications" ALTER COLUMN "tokenIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "synced_methodologies" ALTER COLUMN "syncedFromBlock" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SbtiTarget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "baseYear" INTEGER NOT NULL,
    "baseYearEmissions" DOUBLE PRECISION NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "reductionPercentage" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "validationId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SbtiTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetProgress" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "emissions" DOUBLE PRECISION NOT NULL,
    "targetEmissions" DOUBLE PRECISION NOT NULL,
    "variance" DOUBLE PRECISION NOT NULL,
    "onTrack" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditionType" TEXT NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "targetFramework" TEXT NOT NULL,
    "targetRequirements" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_confirmations" (
    "id" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "ledgerSequence" INTEGER,
    "finalizedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_cache" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_scorecards" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "calculationDate" TIMESTAMP(3) NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL,
    "riskFactors" JSONB NOT NULL,
    "performanceRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiality_assessments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assessmentYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "impacts" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "doubleMateriality" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "materiality_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esrs_disclosures" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "disclosureRequirement" TEXT NOT NULL,
    "dataPoint" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "assuranceLevel" TEXT,
    "assuredAt" TIMESTAMP(3),
    "assuredBy" TEXT,

    CONSTRAINT "esrs_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submissionId" TEXT,
    "reportUrl" TEXT,
    "metadata" JSONB,

    CONSTRAINT "csrd_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransfer" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionHash" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "CreditTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_activities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_metrics" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metricType" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "topContributors" JSONB NOT NULL,
    "insights" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_engagements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "actionsCount" INTEGER NOT NULL,
    "uniqueDays" INTEGER NOT NULL,
    "contributions" JSONB NOT NULL,
    "collaborationScore" DOUBLE PRECISION NOT NULL,
    "responseTimeAvg" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbam_goods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnCode" TEXT NOT NULL,
    "goodsName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "defaultValue" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,

    CONSTRAINT "cbam_goods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_declarations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "goodsId" TEXT NOT NULL,
    "importDate" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "countryOfOrigin" TEXT NOT NULL,
    "installationId" TEXT,
    "actualEmissions" DOUBLE PRECISION,
    "defaultEmissions" DOUBLE PRECISION NOT NULL,
    "totalEmissions" DOUBLE PRECISION NOT NULL,
    "certificateCost" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "import_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbam_quarterly_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submissionId" TEXT,
    "totalEmissions" DOUBLE PRECISION NOT NULL,
    "certificatesRequired" INTEGER NOT NULL,
    "certificatesPurchased" INTEGER,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbam_quarterly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReportDeclarations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReportDeclarations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_confirmations_transactionHash_key" ON "transaction_confirmations"("transactionHash");

-- CreateIndex
CREATE INDEX "transaction_confirmations_companyId_idx" ON "transaction_confirmations"("companyId");

-- CreateIndex
CREATE INDEX "analytics_cache_metricType_period_date_idx" ON "analytics_cache"("metricType", "period", "date");

-- CreateIndex
CREATE INDEX "analytics_cache_companyId_idx" ON "analytics_cache"("companyId");

-- CreateIndex
CREATE INDEX "analytics_cache_expiresAt_idx" ON "analytics_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "project_scorecards_projectId_calculationDate_idx" ON "project_scorecards"("projectId", "calculationDate");

-- CreateIndex
CREATE INDEX "project_scorecards_performanceRank_idx" ON "project_scorecards"("performanceRank");

-- CreateIndex
CREATE INDEX "materiality_assessments_companyId_idx" ON "materiality_assessments"("companyId");

-- CreateIndex
CREATE INDEX "materiality_assessments_assessmentYear_idx" ON "materiality_assessments"("assessmentYear");

-- CreateIndex
CREATE INDEX "esrs_disclosures_companyId_idx" ON "esrs_disclosures"("companyId");

-- CreateIndex
CREATE INDEX "esrs_disclosures_reportingPeriod_idx" ON "esrs_disclosures"("reportingPeriod");

-- CreateIndex
CREATE INDEX "esrs_disclosures_standard_idx" ON "esrs_disclosures"("standard");

-- CreateIndex
CREATE INDEX "csrd_reports_companyId_idx" ON "csrd_reports"("companyId");

-- CreateIndex
CREATE INDEX "csrd_reports_reportingYear_idx" ON "csrd_reports"("reportingYear");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransfer_purchaseId_key" ON "CreditTransfer"("purchaseId");

-- CreateIndex
CREATE INDEX "CreditTransfer_purchaseId_idx" ON "CreditTransfer"("purchaseId");

-- CreateIndex
CREATE INDEX "CreditTransfer_companyId_idx" ON "CreditTransfer"("companyId");

-- CreateIndex
CREATE INDEX "CreditTransfer_status_idx" ON "CreditTransfer"("status");

-- CreateIndex
CREATE INDEX "team_activities_companyId_timestamp_idx" ON "team_activities"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "team_activities_userId_timestamp_idx" ON "team_activities"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "collaboration_metrics_companyId_periodStart_idx" ON "collaboration_metrics"("companyId", "periodStart");

-- CreateIndex
CREATE INDEX "collaboration_metrics_companyId_metricType_idx" ON "collaboration_metrics"("companyId", "metricType");

-- CreateIndex
CREATE INDEX "member_engagements_companyId_periodStart_idx" ON "member_engagements"("companyId", "periodStart");

-- CreateIndex
CREATE INDEX "member_engagements_companyId_userId_idx" ON "member_engagements"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_engagements_companyId_userId_periodStart_periodEnd_key" ON "member_engagements"("companyId", "userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "cbam_goods_companyId_idx" ON "cbam_goods"("companyId");

-- CreateIndex
CREATE INDEX "cbam_goods_sector_idx" ON "cbam_goods"("sector");

-- CreateIndex
CREATE INDEX "cbam_goods_cnCode_idx" ON "cbam_goods"("cnCode");

-- CreateIndex
CREATE INDEX "import_declarations_companyId_idx" ON "import_declarations"("companyId");

-- CreateIndex
CREATE INDEX "import_declarations_importDate_idx" ON "import_declarations"("importDate");

-- CreateIndex
CREATE INDEX "import_declarations_goodsId_idx" ON "import_declarations"("goodsId");

-- CreateIndex
CREATE INDEX "cbam_quarterly_reports_companyId_idx" ON "cbam_quarterly_reports"("companyId");

-- CreateIndex
CREATE INDEX "cbam_quarterly_reports_status_idx" ON "cbam_quarterly_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cbam_quarterly_reports_companyId_year_quarter_key" ON "cbam_quarterly_reports"("companyId", "year", "quarter");

-- CreateIndex
CREATE INDEX "_ReportDeclarations_B_index" ON "_ReportDeclarations"("B");

-- AddForeignKey
ALTER TABLE "SbtiTarget" ADD CONSTRAINT "SbtiTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProgress" ADD CONSTRAINT "TargetProgress_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SbtiTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_confirmations" ADD CONSTRAINT "transaction_confirmations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_assessments" ADD CONSTRAINT "materiality_assessments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esrs_disclosures" ADD CONSTRAINT "esrs_disclosures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_reports" ADD CONSTRAINT "csrd_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_metrics" ADD CONSTRAINT "collaboration_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_engagements" ADD CONSTRAINT "member_engagements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbam_goods" ADD CONSTRAINT "cbam_goods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_declarations" ADD CONSTRAINT "import_declarations_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "cbam_goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_declarations" ADD CONSTRAINT "import_declarations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbam_quarterly_reports" ADD CONSTRAINT "cbam_quarterly_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportDeclarations" ADD CONSTRAINT "_ReportDeclarations_A_fkey" FOREIGN KEY ("A") REFERENCES "cbam_quarterly_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportDeclarations" ADD CONSTRAINT "_ReportDeclarations_B_fkey" FOREIGN KEY ("B") REFERENCES "import_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "emission_factors_source_activity_type_unit_region_valid_from_ke" RENAME TO "emission_factors_source_activity_type_unit_region_valid_fro_key";
