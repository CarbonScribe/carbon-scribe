import { apiClient, ApiResponse } from './api-client';

// Types for Portfolio API responses (can be refined based on backend interfaces)
export interface PortfolioSummaryMetrics {
  totalRetired: number;
  availableBalance: number;
  quarterlyGrowth: number;
  netZeroProgress: number;
  scope3Coverage: number;
  sdgAlignment: number;
  costEfficiency: number;
  lastUpdatedAt: string;
}

export interface PortfolioPerformance {
  portfolioValue: number;
  avgPricePerTon: number;
  creditsHeld: number;
  projectDiversity: number;
  performanceTrends: { month: string; value: number }[];
  monthlyRetirements: { month: string; value: number }[];
}

export interface PortfolioComposition {
  methodologyDistribution: { name: string; value: number; percentage: number }[];
  geographicAllocation: { name: string; value: number; percentage: number }[];
  sdgImpact: { name: string; value: number; percentage: number }[];
  vintageYearDistribution: { name: string; value: number; percentage: number }[];
  projectTypeClassification: { name: string; value: number; percentage: number }[];
}

export interface PortfolioTimeline {
  portfolioGrowth: { monthly: any[]; quarterly: any[]; yearly: any[] };
  retirementTrends: any;
  valueOverTime: any;
}

export interface PortfolioRisk {
  diversificationScore: number;
  riskRating: string;
  concentrationAnalysis: any;
  volatility: number;
}

export interface PortfolioHolding {
  id: string;
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  credit: { id: string; projectName: string };
}

export interface PortfolioHoldingsResponse {
  data: PortfolioHolding[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface PortfolioAnalytics {
  summary: PortfolioSummaryMetrics;
  performance: PortfolioPerformance;
  composition: PortfolioComposition;
  timeline: PortfolioTimeline;
  risk: PortfolioRisk;
  generatedAt: string;
}

export const portfolioService = {
  async getSummary(): Promise<ApiResponse<PortfolioSummaryMetrics>> {
    return apiClient.get<PortfolioSummaryMetrics>('/portfolio/summary');
  },
  async getPerformance(): Promise<ApiResponse<PortfolioPerformance>> {
    return apiClient.get<PortfolioPerformance>('/portfolio/performance');
  },
  async getComposition(): Promise<ApiResponse<PortfolioComposition>> {
    return apiClient.get<PortfolioComposition>('/portfolio/composition');
  },
  async getTimeline(params?: { startDate?: string; endDate?: string; aggregation?: string }): Promise<ApiResponse<PortfolioTimeline>> {
    const query = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return apiClient.get<PortfolioTimeline>(`/portfolio/timeline${query}`);
  },
  async getRisk(): Promise<ApiResponse<PortfolioRisk>> {
    return apiClient.get<PortfolioRisk>('/portfolio/risk');
  },
  async getHoldings(params?: { page?: number; pageSize?: number }): Promise<ApiResponse<PortfolioHoldingsResponse>> {
    const query = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return apiClient.get<PortfolioHoldingsResponse>(`/portfolio/holdings${query}`);
  },
  async getAnalytics(): Promise<ApiResponse<PortfolioAnalytics>> {
    return apiClient.get<PortfolioAnalytics>('/portfolio/analytics');
  },
  async getHoldingById(id: string): Promise<ApiResponse<PortfolioHolding>> {
    return apiClient.get<PortfolioHolding>(`/portfolio/${id}`);
  },
};

export default portfolioService;
