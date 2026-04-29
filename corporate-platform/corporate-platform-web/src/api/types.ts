/**
 * TypeScript interfaces for Portfolio API responses
 */

// Portfolio Summary
export interface PortfolioSummary {
  totalRetired: number;
  availableBalance: number;
  quarterlyGrowth: number; // percentage
  netZeroProgress: number; // percentage
  scope3Coverage: number; // percentage
  sdgAlignment: number; // percentage
  costEfficiency: number;
  lastUpdatedAt: string; // ISO date
}

// Portfolio Performance
export interface PerformanceTrendItem {
  month: string;
  value: number;
}

export interface PortfolioPerformance {
  portfolioValue: number;
  avgPricePerTon: number;
  creditsHeld: number;
  projectDiversity: number;
  performanceTrends: PerformanceTrendItem[];
  monthlyRetirements: PerformanceTrendItem[];
}

// Distribution items
export interface DistributionItem {
  name: string;
  value: number;
  percentage: number;
  [key: string]: string | number;
}

// Portfolio Composition
export interface PortfolioComposition {
  methodologyDistribution: DistributionItem[];
  geographicAllocation: DistributionItem[];
  sdgImpact: DistributionItem[];
  vintageYearDistribution: DistributionItem[];
  projectTypeClassification: DistributionItem[];
}

// Timeline data point
export interface TimelineDataPoint {
  timestamp: string; // ISO date
  growth: number;
  retirements: number;
  portfolioValue: number;
}

// Risk Analysis
export interface ConcentrationAnalysis {
  topProject: {
    name: string;
    percentage: number;
  };
  topCountry: {
    name: string;
    percentage: number;
  };
  herfindahlIndex: number;
}

export interface ProjectQualityDistribution {
  highQuality: number;
  mediumQuality: number;
  lowQuality: number;
}

export interface RiskAnalysis {
  diversificationScore: number;
  riskRating: "Low" | "Medium" | "High";
  concentrationAnalysis: ConcentrationAnalysis;
  volatility: number;
  projectQualityDistribution: ProjectQualityDistribution;
}

// Portfolio Holding
export interface CreditQualityMetrics {
  dynamicScore: number;
  verificationScore: number;
  additionalityScore: number;
  permanenceScore: number;
  leakageScore: number;
  cobenefitsScore: number;
  transparencyScore: number;
}

export interface PortfolioHolding {
  id: string;
  creditId: string;
  companyId: string;
  creditAmount: number;
  purchasePrice: number;
  purchaseDate: string; // ISO date
  currentValue: number;
  status: "available" | "reserved" | "retired";
  credit: {
    projectName: string;
    methodology: string;
    country: string;
    vintage: number;
    verificationStandard: "VERRA" | "GOLD_STANDARD" | "CCB";
    sdgs: string[];
    qualityMetrics: CreditQualityMetrics;
  };
}

// Paginated holdings response
export interface PaginatedHoldings {
  holdings: PortfolioHolding[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Transaction
export interface Transaction {
  id: string;
  type: "order" | "refund" | "adjustment" | "transfer";
  status: "pending" | "completed" | "failed";
  amount: number;
  pricePerUnit: number;
  totalPrice: number;
  creditId: string;
  projectName: string;
  timestamp: string; // ISO date
  metadata?: Record<string, any>;
}

// Analytics (combined dashboard data)
export interface PortfolioAnalytics {
  summary: PortfolioSummary;
  performance: PortfolioPerformance;
  composition: PortfolioComposition;
  riskAnalysis: RiskAnalysis;
}

// Pagination query params
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// Timeline query params
export interface TimelineQueryParams {
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  aggregation?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
}
