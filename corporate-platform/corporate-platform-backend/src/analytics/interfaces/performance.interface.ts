export interface PerformanceTimeSeries {
  metric: string;
  data: TimeSeriesPoint[];
  comparison?: TimeSeriesComparison;
  aggregation: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface TimeSeriesPoint {
  date: Date;
  value: number;
  previousPeriod?: number;
  change?: number;
  percentageChange?: number;
}

export interface TimeSeriesComparison {
  current: TimeSeriesPoint[];
  previous: TimeSeriesPoint[];
  comparison: 'mom' | 'yoy' | 'custom';
}

export interface MetricBreakdown {
  metric: string;
  totalValue: number;
  byDimension: DimensionMetric[];
  distribution: Record<string, number>;
}

export interface DimensionMetric {
  dimension: string;
  value: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface PerformanceRanking {
  metric: string;
  rankings: RankedItem[];
  period: string;
}

export interface RankedItem {
  rank: number;
  projectId: string;
  projectName: string;
  value: number;
  percentile: number;
  previousRank?: number;
  rankChange?: number;
}

export interface RollingAverage {
  metric: string;
  window: number; // days
  values: RollingPoint[];
}

export interface RollingPoint {
  date: Date;
  average: number;
  dataPoints: number;
}

export interface PerformanceComparison {
  metric: string;
  current: {
    value: number;
    period: string;
  };
  previous: {
    value: number;
    period: string;
  };
  change: number;
  percentageChange: number;
  trend: 'improving' | 'declining' | 'stable';
}
