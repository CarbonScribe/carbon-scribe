export interface CompositionBreakdown {
  name: string;
  value: number;
  percentage: number;
}

export interface CompositionMetrics {
  methodologyDistribution: CompositionBreakdown[];
  geographicAllocation: CompositionBreakdown[];
  sdgImpact: CompositionBreakdown[];
  vintageYearDistribution: CompositionBreakdown[];
  projectTypeClassification: CompositionBreakdown[];
}

export interface PortfolioCompositionResponse {
  success: boolean;
  data: CompositionMetrics;
  timestamp: Date;
}
