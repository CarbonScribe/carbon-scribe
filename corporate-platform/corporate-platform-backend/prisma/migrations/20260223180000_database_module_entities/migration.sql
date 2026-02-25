-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "methodology" TEXT,
    "standard" TEXT,
    "country" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "totalRetired" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_entries" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliances" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requirements" JSONB,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "params" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Credit" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "projects_companyId_idx" ON "projects"("companyId");

-- CreateIndex
CREATE INDEX "portfolios_companyId_idx" ON "portfolios"("companyId");
CREATE INDEX "portfolios_asOfDate_idx" ON "portfolios"("asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_entries_portfolioId_creditId_key" ON "portfolio_entries"("portfolioId", "creditId");
CREATE INDEX "portfolio_entries_portfolioId_idx" ON "portfolio_entries"("portfolioId");
CREATE INDEX "portfolio_entries_creditId_idx" ON "portfolio_entries"("creditId");

-- CreateIndex
CREATE INDEX "transactions_companyId_idx" ON "transactions"("companyId");
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "compliances_companyId_idx" ON "compliances"("companyId");
CREATE INDEX "compliances_framework_idx" ON "compliances"("framework");
CREATE INDEX "compliances_status_idx" ON "compliances"("status");

-- CreateIndex
CREATE INDEX "reports_companyId_idx" ON "reports"("companyId");
CREATE INDEX "reports_type_idx" ON "reports"("type");
CREATE INDEX "reports_generatedAt_idx" ON "reports"("generatedAt");

-- CreateIndex
CREATE INDEX "activities_companyId_idx" ON "activities"("companyId");
CREATE INDEX "activities_userId_idx" ON "activities"("userId");
CREATE INDEX "activities_action_idx" ON "activities"("action");
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE INDEX "Credit_projectId_idx" ON "Credit"("projectId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_entries" ADD CONSTRAINT "portfolio_entries_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_entries" ADD CONSTRAINT "portfolio_entries_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliances" ADD CONSTRAINT "compliances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
