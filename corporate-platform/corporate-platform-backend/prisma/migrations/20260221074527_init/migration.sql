-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "available" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "purposeDetails" TEXT,
    "priceAtRetirement" DOUBLE PRECISION NOT NULL,
    "certificateId" TEXT,
    "certificateUrl" TEXT,
    "transactionHash" TEXT,
    "transactionUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementCertificate" (
    "id" TEXT NOT NULL,
    "retirementId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "ipfsHash" TEXT,
    "companyName" TEXT NOT NULL,
    "retirementDate" TIMESTAMP(3) NOT NULL,
    "creditProject" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "creditPurpose" TEXT NOT NULL,
    "transactionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetirementCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Retirement_certificateId_key" ON "Retirement"("certificateId");

-- CreateIndex
CREATE INDEX "Retirement_companyId_idx" ON "Retirement"("companyId");

-- CreateIndex
CREATE INDEX "Retirement_creditId_idx" ON "Retirement"("creditId");

-- CreateIndex
CREATE INDEX "Retirement_purpose_idx" ON "Retirement"("purpose");

-- CreateIndex
CREATE INDEX "Retirement_retiredAt_idx" ON "Retirement"("retiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementCertificate_retirementId_key" ON "RetirementCertificate"("retirementId");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementCertificate_certificateNumber_key" ON "RetirementCertificate"("certificateNumber");

-- AddForeignKey
ALTER TABLE "Retirement" ADD CONSTRAINT "Retirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retirement" ADD CONSTRAINT "Retirement_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementCertificate" ADD CONSTRAINT "RetirementCertificate_retirementId_fkey" FOREIGN KEY ("retirementId") REFERENCES "Retirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
