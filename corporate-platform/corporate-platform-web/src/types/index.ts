export interface CarbonCredit {
    id: string
    projectId: string
    projectName: string
    country: string
    methodology: string
    vintage: number
    availableAmount: number
    pricePerTon: number
    currency: string
    status: 'available' | 'reserved' | 'retired'
    verificationStandard: 'VERRA' | 'GOLD_STANDARD' | 'CCB'
    sdgs: number[]
    coBenefits: string[]
    imageUrl: string
    lastVerification: string
    dynamicScore: number
  }
  
  export interface Retirement {
    id: string
    creditId: string
    amount: number
    date: string
    purpose: string
    certificateUrl: string
    transactionHash: string
    projectName: string
  }
  
  export interface PortfolioMetrics {
    totalRetired: number
    currentBalance: number
    totalSpent: number
    avgPricePerTon: number
    sdgContributions: Record<number, number>
    monthlyRetirements: Array<{ month: string; amount: number }>
  }
  
  export interface Company {
    id: string
    name: string
    industry: string
    sustainabilityGoals: string[]
    targetNetZero: number
    currentFootprint: number
    creditsRetired: number
    creditsAvailable: number
  }

  // =============== Compliance Types ===============

  export enum ComplianceFramework {
    CBAM = 'CBAM',
    CORSIA = 'CORSIA',
    ARTICLE_6 = 'ARTICLE_6',
    SBTi = 'SBTi',
    CDP = 'CDP',
    GRI = 'GRI',
    CSRD = 'CSRD',
    TCFD = 'TCFD',
  }

  export enum ComplianceStatus {
    COMPLIANT = 'compliant',
    IN_PROGRESS = 'in_progress',
    NOT_STARTED = 'not_started',
    NON_COMPLIANT = 'non_compliant',
    PENDING_REVIEW = 'pending_review',
  }

  export enum EntityType {
    CREDIT = 'CREDIT',
    TRANSACTION = 'TRANSACTION',
    PROJECT = 'PROJECT',
    USER = 'USER',
    COMPANY = 'COMPANY',
  }

  export interface ComplianceIssue {
    code: string
    severity: 'error' | 'warning' | 'info'
    message: string
    affectedArea: string
    suggestedAction?: string
  }

  export interface ComplianceRequirement {
    id: string
    name: string
    status: 'met' | 'unmet' | 'pending'
    description: string
    dueDate?: Date | string
    priority: 'high' | 'medium' | 'low'
  }

  export interface ComplianceCheckResult {
    framework: ComplianceFramework
    entityId: string
    entityType: EntityType | string
    status: ComplianceStatus
    timestamp: Date | string
    issues: ComplianceIssue[]
    requirements: ComplianceRequirement[]
    recommendations: string[]
  }

  export interface ComplianceStatusItem {
    entityId: string
    framework: string
    status: ComplianceStatus
    reason?: string
    dueDate?: Date | string
    completedAt?: Date | string
  }

  export interface FrameworkReportDetail {
    framework: ComplianceFramework
    status: ComplianceStatus
    compliance: number
    requirements: ComplianceRequirement[]
    issues: ComplianceIssue[]
  }

  export interface ComplianceReport {
    reportId: string
    entityId: string
    entityType: string
    generatedAt: Date | string
    frameworks: ComplianceFramework[]
    summaryStatus: ComplianceStatus
    overallCompliance: number
    frameworkReports: FrameworkReportDetail[]
    issues: ComplianceIssue[]
    recommendations: string[]
    nextReviewDate: Date | string
    exportFormat?: 'pdf' | 'json' | 'csv'
  }

  export interface CheckComplianceRequest {
    framework: ComplianceFramework
    entityType: EntityType | string
    entityId: string
    requirements?: string[]
    metadata?: Record<string, any>
  }

  export * from './retirement-scheduling'
  export * from './retirement-analytics'