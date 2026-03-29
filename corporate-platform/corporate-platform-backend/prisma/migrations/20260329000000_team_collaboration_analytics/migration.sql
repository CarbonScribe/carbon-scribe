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

    CONSTRAINT "collaboration_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_engagement" (
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

    CONSTRAINT "member_engagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_activities_companyId_timestamp_idx" ON "team_activities"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "team_activities_userId_timestamp_idx" ON "team_activities"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "team_activities_companyId_activityType_timestamp_idx" ON "team_activities"("companyId", "activityType", "timestamp");

-- CreateIndex
CREATE INDEX "collaboration_metrics_companyId_periodStart_periodEnd_idx" ON "collaboration_metrics"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "collaboration_metrics_companyId_metricType_periodStart_idx" ON "collaboration_metrics"("companyId", "metricType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "member_engagement_companyId_userId_periodStart_periodEnd_key" ON "member_engagement"("companyId", "userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "member_engagement_companyId_periodStart_periodEnd_idx" ON "member_engagement"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "member_engagement_companyId_userId_periodStart_idx" ON "member_engagement"("companyId", "userId", "periodStart");

-- AddForeignKey
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_metrics" ADD CONSTRAINT "collaboration_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_engagement" ADD CONSTRAINT "member_engagement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_engagement" ADD CONSTRAINT "member_engagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

