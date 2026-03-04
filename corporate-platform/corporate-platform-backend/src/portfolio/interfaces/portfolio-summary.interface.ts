export interface PortfolioSummaryMetrics {
  totalRetired: number;
  availableBalance: number;
  quarterlyGrowth: number;
  netZeroProgress: number;
  scope3Coverage: number;
  sdgAlignment: number;
  costEfficiency: number;
  lastUpdatedAt: Date;
}

export interface PortfolioSummaryResponse {
  success: boolean;
  data: PortfolioSummaryMetrics;
  timestamp: Date;
}
