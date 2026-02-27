export interface PerformanceTrendPoint {
  month: string;
  value: number;
}

export interface PerformanceMetrics {
  portfolioValue: number;
  avgPricePerTon: number;
  creditsHeld: number;
  projectDiversity: number;
  performanceTrends: PerformanceTrendPoint[];
  monthlyRetirements: PerformanceTrendPoint[];
}

export interface PortfolioPerformanceResponse {
  success: boolean;
  data: PerformanceMetrics;
  timestamp: Date;
}
