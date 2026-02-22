export interface TrendPeriod {
  month: string;
  retired: number;
  target: number;
  cumulative: number;
  previousYearRetired?: number;
}

export interface TrendDataResponse {
  periods: TrendPeriod[];
  aggregation: 'monthly' | 'quarterly';
  totalRetired: number;
  totalTarget: number;
  yearOverYearChange?: number;
}
