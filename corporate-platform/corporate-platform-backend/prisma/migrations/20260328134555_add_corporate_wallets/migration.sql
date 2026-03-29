-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "annualRetirementTarget" REAL NOT NULL DEFAULT 0,
    "netZeroTarget" REAL NOT NULL DEFAULT 0,
    "netZeroTargetYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "retirement_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target" REAL NOT NULL,
    CONSTRAINT "retirement_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "methodology" TEXT,
    "verificationStandard" TEXT,
    "country" TEXT,
    "region" TEXT,
    "companyId" TEXT,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "availableCredits" INTEGER NOT NULL DEFAULT 0,
    "avgScore" REAL,
    "communities" INTEGER,
    "sdgs" JSONB DEFAULT [],
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "lastVerification" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "developer" TEXT,
    "website" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "pricePerTon" REAL NOT NULL DEFAULT 0,
    "availableAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "dynamicScore" INTEGER NOT NULL DEFAULT 0,
    "verificationScore" INTEGER NOT NULL DEFAULT 0,
    "additionalityScore" INTEGER NOT NULL DEFAULT 0,
    "permanenceScore" INTEGER NOT NULL DEFAULT 0,
    "leakageScore" INTEGER NOT NULL DEFAULT 0,
    "cobenefitsScore" INTEGER NOT NULL DEFAULT 0,
    "transparencyScore" INTEGER NOT NULL DEFAULT 0,
    "methodology" TEXT,
    "vintage" INTEGER,
    "verificationStandard" TEXT,
    "lastVerification" DATETIME,
    "country" TEXT,
    "sdgs" JSONB DEFAULT [],
    "assetCode" TEXT,
    "issuer" TEXT,
    "contractId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "searchVector" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "lastPurchasedAt" DATETIME,
    CONSTRAINT "Credit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Credit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Retirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "purposeDetails" TEXT,
    "priceAtRetirement" REAL NOT NULL,
    "certificateId" TEXT,
    "certificateUrl" TEXT,
    "transactionHash" TEXT,
    "transactionUrl" TEXT,
    "verifiedAt" DATETIME,
    "retiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Retirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retirement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retirement_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetirementCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retirementId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "ipfsHash" TEXT,
    "companyName" TEXT NOT NULL,
    "retirementDate" DATETIME NOT NULL,
    "creditProject" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "creditPurpose" TEXT NOT NULL,
    "transactionHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetirementCertificate_retirementId_fkey" FOREIGN KEY ("retirementId") REFERENCES "Retirement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "companyId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "lastLoginAt" DATETIME,
    "lastLoginIp" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetToken" TEXT,
    "passwordResetExpires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "invitedAt" DATETIME,
    "lastActiveAt" DATETIME,
    "metadata" JSONB,
    "department" TEXT,
    "title" TEXT,
    CONSTRAINT "TeamMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT [],
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IpWhitelist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IpWhitelist_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "startPrice" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "floorPrice" REAL NOT NULL,
    "priceDecrement" REAL NOT NULL,
    "decrementInterval" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "lastPriceUpdate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "winnerId" TEXT,
    "finalPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Auction_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bidPrice" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bid_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetirementSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "creditSelection" TEXT NOT NULL,
    "creditIds" JSONB DEFAULT [],
    "frequency" TEXT NOT NULL,
    "interval" INTEGER,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "nextRunDate" DATETIME NOT NULL,
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastRunDate" DATETIME,
    "lastRunStatus" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "notifyBefore" INTEGER,
    "notifyAfter" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RetirementSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RetirementSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "runAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledDate" DATETIME,
    "executedDate" DATETIME,
    "amountRetired" INTEGER,
    "retirementIds" JSONB DEFAULT [],
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryDate" DATETIME,
    CONSTRAINT "ScheduleExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RetirementSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchRetirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "completedItems" INTEGER NOT NULL,
    "failedItems" INTEGER NOT NULL,
    "retirementIds" JSONB DEFAULT [],
    "errorLog" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "scheduleId" TEXT,
    "executionId" TEXT,
    CONSTRAINT "BatchRetirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchRetirement_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RetirementSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchRetirement_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ScheduleExecution" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "serviceFee" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cart_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CartItem_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cartId" TEXT,
    "subtotal" REAL NOT NULL,
    "serviceFee" REAL NOT NULL,
    "total" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentId" TEXT,
    "transactionHash" TEXT,
    "notes" TEXT,
    "paidAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "CreditReservation_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditReservation_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "totalRetired" INTEGER NOT NULL DEFAULT 0,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "avgPricePerTon" REAL NOT NULL DEFAULT 0,
    "netZeroTarget" INTEGER,
    "netZeroProgress" REAL NOT NULL DEFAULT 0,
    "scope3Coverage" REAL NOT NULL DEFAULT 0,
    "diversificationScore" INTEGER NOT NULL DEFAULT 0,
    "riskRating" TEXT NOT NULL DEFAULT 'Low',
    "avgVintage" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "portfolios_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasePrice" REAL NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "currentValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "portfolio_holdings_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portfolio_holdings_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "totalValue" REAL NOT NULL,
    "totalRetired" INTEGER NOT NULL,
    "currentBalance" INTEGER NOT NULL,
    "methodologyDistribution" JSONB NOT NULL,
    "geographicDistribution" JSONB NOT NULL,
    "sdgDistribution" JSONB NOT NULL,
    "snapshotDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolio_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_entries_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portfolio_entries_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_availability_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditId" TEXT NOT NULL,
    "changedBy" TEXT,
    "changeType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "previousAmount" INTEGER NOT NULL,
    "newAmount" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_availability_logs_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "compliances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requirements" JSONB,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "compliances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "params" JSONB,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "permissions" JSONB DEFAULT [],
    "lastUsedAt" DATETIME,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "ipWhitelist" JSONB DEFAULT [],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "revokedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IpfsDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "ipfsGateway" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT true,
    "pinnedAt" DATETIME NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "IpfsDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "frameworks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirements" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "synced_methodologies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "registry" TEXT,
    "category" TEXT,
    "authority" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "framework_methodology_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkId" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "methodologyTokenId" INTEGER NOT NULL,
    "requirementIds" JSONB DEFAULT [],
    "mappingType" TEXT NOT NULL,
    "mappedBy" TEXT,
    "mappedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    CONSTRAINT "framework_methodology_mappings_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "frameworks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "framework_methodology_mappings_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "synced_methodologies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mapping_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditionType" TEXT NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "targetFramework" TEXT NOT NULL,
    "targetRequirements" JSONB DEFAULT [],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME NOT NULL,
    "nextAttemptAt" DATETIME,
    "deliveredAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "transaction_confirmations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionHash" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "ledgerSequence" INTEGER,
    "finalizedAt" DATETIME,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transaction_confirmations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "materiality_assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "assessmentYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" DATETIME,
    "impacts" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "doubleMateriality" JSONB NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "materiality_assessments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "esrs_disclosures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "disclosureRequirement" TEXT NOT NULL,
    "dataPoint" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "assuranceLevel" TEXT,
    "assuredAt" DATETIME,
    "assuredBy" TEXT,
    CONSTRAINT "esrs_disclosures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "csrd_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "submissionId" TEXT,
    "reportUrl" TEXT,
    "metadata" JSONB,
    CONSTRAINT "csrd_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionHash" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "initiatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME
);

-- CreateTable
CREATE TABLE "credit_ownership_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" INTEGER NOT NULL,
    "companyId" TEXT,
    "previousOwner" TEXT NOT NULL,
    "newOwner" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "ledgerSequence" INTEGER NOT NULL,
    "metadata" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "credit_current_owners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "corporate_wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "corporate_wallets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tokenIds" JSONB DEFAULT [],
    "metadata" JSONB,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    CONSTRAINT "wallet_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "corporate_wallets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "retirement_targets_companyId_year_month_key" ON "retirement_targets"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "projects_country_idx" ON "projects"("country");

-- CreateIndex
CREATE INDEX "projects_type_idx" ON "projects"("type");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "Credit_status_idx" ON "Credit"("status");

-- CreateIndex
CREATE INDEX "Credit_companyId_idx" ON "Credit"("companyId");

-- CreateIndex
CREATE INDEX "Credit_companyId_status_idx" ON "Credit"("companyId", "status");

-- CreateIndex
CREATE INDEX "Credit_country_idx" ON "Credit"("country");

-- CreateIndex
CREATE INDEX "Credit_methodology_idx" ON "Credit"("methodology");

-- CreateIndex
CREATE INDEX "Credit_vintage_idx" ON "Credit"("vintage");

-- CreateIndex
CREATE INDEX "Credit_dynamicScore_idx" ON "Credit"("dynamicScore");

-- CreateIndex
CREATE UNIQUE INDEX "Retirement_certificateId_key" ON "Retirement"("certificateId");

-- CreateIndex
CREATE INDEX "Retirement_companyId_idx" ON "Retirement"("companyId");

-- CreateIndex
CREATE INDEX "Retirement_userId_idx" ON "Retirement"("userId");

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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_companyId_status_idx" ON "TeamMember"("companyId", "status");

-- CreateIndex
CREATE INDEX "TeamMember_roleId_idx" ON "TeamMember"("roleId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_companyId_status_idx" ON "Invitation"("companyId", "status");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_refreshToken_idx" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

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
CREATE INDEX "RetirementSchedule_companyId_idx" ON "RetirementSchedule"("companyId");

-- CreateIndex
CREATE INDEX "RetirementSchedule_userId_idx" ON "RetirementSchedule"("userId");

-- CreateIndex
CREATE INDEX "RetirementSchedule_isActive_nextRunDate_idx" ON "RetirementSchedule"("isActive", "nextRunDate");

-- CreateIndex
CREATE INDEX "ScheduleExecution_scheduleId_idx" ON "ScheduleExecution"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleExecution_status_idx" ON "ScheduleExecution"("status");

-- CreateIndex
CREATE INDEX "ScheduleExecution_runAt_idx" ON "ScheduleExecution"("runAt");

-- CreateIndex
CREATE INDEX "BatchRetirement_companyId_idx" ON "BatchRetirement"("companyId");

-- CreateIndex
CREATE INDEX "BatchRetirement_scheduleId_idx" ON "BatchRetirement"("scheduleId");

-- CreateIndex
CREATE INDEX "BatchRetirement_executionId_idx" ON "BatchRetirement"("executionId");

-- CreateIndex
CREATE INDEX "Cart_companyId_idx" ON "Cart"("companyId");

-- CreateIndex
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_creditId_idx" ON "CartItem"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_creditId_key" ON "CartItem"("cartId", "creditId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_creditId_idx" ON "OrderItem"("creditId");

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
CREATE UNIQUE INDEX "portfolios_companyId_key" ON "portfolios"("companyId");

-- CreateIndex
CREATE INDEX "portfolios_companyId_idx" ON "portfolios"("companyId");

-- CreateIndex
CREATE INDEX "portfolio_holdings_portfolioId_idx" ON "portfolio_holdings"("portfolioId");

-- CreateIndex
CREATE INDEX "portfolio_holdings_creditId_idx" ON "portfolio_holdings"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_holdings_portfolioId_creditId_key" ON "portfolio_holdings"("portfolioId", "creditId");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_portfolioId_snapshotDate_idx" ON "portfolio_snapshots"("portfolioId", "snapshotDate");

-- CreateIndex
CREATE INDEX "portfolio_entries_portfolioId_idx" ON "portfolio_entries"("portfolioId");

-- CreateIndex
CREATE INDEX "portfolio_entries_creditId_idx" ON "portfolio_entries"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_entries_portfolioId_creditId_key" ON "portfolio_entries"("portfolioId", "creditId");

-- CreateIndex
CREATE INDEX "credit_availability_logs_creditId_idx" ON "credit_availability_logs"("creditId");

-- CreateIndex
CREATE INDEX "credit_availability_logs_createdAt_idx" ON "credit_availability_logs"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_companyId_idx" ON "transactions"("companyId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "compliances_companyId_idx" ON "compliances"("companyId");

-- CreateIndex
CREATE INDEX "compliances_framework_idx" ON "compliances"("framework");

-- CreateIndex
CREATE INDEX "compliances_status_idx" ON "compliances"("status");

-- CreateIndex
CREATE INDEX "reports_companyId_idx" ON "reports"("companyId");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_generatedAt_idx" ON "reports"("generatedAt");

-- CreateIndex
CREATE INDEX "activities_companyId_idx" ON "activities"("companyId");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_action_idx" ON "activities"("action");

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_companyId_idx" ON "ApiKey"("companyId");

-- CreateIndex
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "IpfsDocument_ipfsCid_key" ON "IpfsDocument"("ipfsCid");

-- CreateIndex
CREATE INDEX "IpfsDocument_companyId_idx" ON "IpfsDocument"("companyId");

-- CreateIndex
CREATE INDEX "IpfsDocument_referenceId_idx" ON "IpfsDocument"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "frameworks_code_key" ON "frameworks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "synced_methodologies_tokenId_key" ON "synced_methodologies"("tokenId");

-- CreateIndex
CREATE INDEX "framework_methodology_mappings_methodologyTokenId_idx" ON "framework_methodology_mappings"("methodologyTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "framework_methodology_mappings_frameworkId_methodologyId_key" ON "framework_methodology_mappings"("frameworkId", "methodologyId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_confirmations_transactionHash_key" ON "transaction_confirmations"("transactionHash");

-- CreateIndex
CREATE INDEX "transaction_confirmations_companyId_idx" ON "transaction_confirmations"("companyId");

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
CREATE INDEX "credit_ownership_history_tokenId_idx" ON "credit_ownership_history"("tokenId");

-- CreateIndex
CREATE INDEX "credit_ownership_history_newOwner_idx" ON "credit_ownership_history"("newOwner");

-- CreateIndex
CREATE INDEX "credit_ownership_history_transactionHash_idx" ON "credit_ownership_history"("transactionHash");

-- CreateIndex
CREATE INDEX "credit_ownership_history_timestamp_idx" ON "credit_ownership_history"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "credit_current_owners_tokenId_key" ON "credit_current_owners"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_wallets_companyId_key" ON "corporate_wallets"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_wallets_publicKey_key" ON "corporate_wallets"("publicKey");

-- CreateIndex
CREATE INDEX "corporate_wallets_companyId_idx" ON "corporate_wallets"("companyId");

-- CreateIndex
CREATE INDEX "corporate_wallets_publicKey_idx" ON "corporate_wallets"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_transactionHash_key" ON "wallet_transactions"("transactionHash");

-- CreateIndex
CREATE INDEX "wallet_transactions_companyId_idx" ON "wallet_transactions"("companyId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");

-- CreateIndex
CREATE INDEX "wallet_transactions_transactionHash_idx" ON "wallet_transactions"("transactionHash");

-- CreateIndex
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "wallet_transactions_submittedAt_idx" ON "wallet_transactions"("submittedAt");
