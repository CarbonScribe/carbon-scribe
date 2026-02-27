export interface TimelineDataPoint {
  date: string;
  value: number;
}

export interface TimelineAggregation {
  monthly: TimelineDataPoint[];
  quarterly: TimelineDataPoint[];
  yearly: TimelineDataPoint[];
}

export interface TimelineMetrics {
  portfolioGrowth: TimelineAggregation;
  retirementTrends: TimelineAggregation;
  valueOverTime: TimelineAggregation;
}

export interface PortfolioTimelineResponse {
  success: boolean;
  data: TimelineMetrics;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  timestamp: Date;
}
