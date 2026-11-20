import { apiClient, ApiResponse, ApiFetchOptions } from './api-client';

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
  async getSummary(options?: ApiFetchOptions): Promise<ApiResponse<PortfolioSummaryMetrics>> {
    return apiClient.get<PortfolioSummaryMetrics>('/portfolio/summary', options);
  },
  async getPerformance(options?: ApiFetchOptions): Promise<ApiResponse<PortfolioPerformance>> {
    return apiClient.get<PortfolioPerformance>('/portfolio/performance', options);
  },
  async getComposition(options?: ApiFetchOptions): Promise<ApiResponse<PortfolioComposition>> {
    return apiClient.get<PortfolioComposition>('/portfolio/composition', options);
  },
  async getTimeline(params?: { startDate?: string; endDate?: string; aggregation?: string }, options?: ApiFetchOptions): Promise<ApiResponse<PortfolioTimeline>> {
    const query = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return apiClient.get<PortfolioTimeline>(`/portfolio/timeline${query}`, options);
  },
  async getRisk(options?: ApiFetchOptions): Promise<ApiResponse<PortfolioRisk>> {
    return apiClient.get<PortfolioRisk>('/portfolio/risk', options);
  },
  async getHoldings(params?: { page?: number; pageSize?: number }, options?: ApiFetchOptions): Promise<ApiResponse<PortfolioHoldingsResponse>> {
    const query = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return apiClient.get<PortfolioHoldingsResponse>(`/portfolio/holdings${query}`, options);
  },
  async getAnalytics(options?: ApiFetchOptions): Promise<ApiResponse<PortfolioAnalytics>> {
    return apiClient.get<PortfolioAnalytics>('/portfolio/analytics', options);
  },
  async getHoldingById(id: string, options?: ApiFetchOptions): Promise<ApiResponse<PortfolioHolding>> {
    return apiClient.get<PortfolioHolding>(`/portfolio/${id}`, options);
  },
  /**
   * Export transactions list as a CSV Blob.
   */
  async exportTransactionsCsv(transactions: Array<{
    id?: string;
    date?: string;
    type?: string;
    project?: string;
    amount?: number;
    price?: number;
    status?: string;
  }>): Promise<Blob> {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions available to export');
    }

    const escapeCsvValue = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['ID', 'Date', 'Type', 'Project', 'Amount', 'Price', 'Status'];
    const rows = transactions.map((tx) => [
      escapeCsvValue(tx.id || ''),
      escapeCsvValue(tx.date ? (isNaN(new Date(tx.date).getTime()) ? tx.date : new Date(tx.date).toISOString().split('T')[0]) : 'N/A'),
      escapeCsvValue(tx.type || 'N/A'),
      escapeCsvValue(tx.project || 'N/A'),
      escapeCsvValue(tx.amount !== undefined ? tx.amount : 0),
      escapeCsvValue(tx.price !== undefined ? tx.price : 0),
      escapeCsvValue(tx.status || 'Completed'),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  },
  async exportCsv(transactions: Array<{
    id?: string;
    date?: string;
    type?: string;
    project?: string;
    amount?: number;
    price?: number;
    status?: string;
  }>): Promise<Blob> {
    return this.exportTransactionsCsv(transactions);
  },
};

export const exportPortfolioTransactionsCsv = portfolioService.exportTransactionsCsv.bind(portfolioService);

export default portfolioService;
