export interface RetirementAnalyticsQuery {
  companyId: string;
  startDate?: string;
  endDate?: string;
  aggregation?: 'monthly' | 'quarterly';
}

export interface PurposeBreakdownItem {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface PurposeBreakdownResponse {
  purposes: PurposeBreakdownItem[];
  totalRetired: number;
  periodStart: string;
  periodEnd: string;
}

export interface TrendPeriod {
  month: string;
  retired: number;
  target: number;
  cumulative: number;
  previousYearRetired?: number;
}

export interface TrendsResponse {
  periods: TrendPeriod[];
  aggregation: 'monthly' | 'quarterly';
  totalRetired: number;
  totalTarget: number;
  yearOverYearChange?: number;
}

export interface ForecastProjection {
  period: string;
  predicted: number;
  confidence: {
    lower: number;
    upper: number;
  };
}

export interface ForecastResponse {
  projections: ForecastProjection[];
  methodology: string;
  basedOnMonths: number;
}

export interface ImpactResponse {
  co2Offset: number;
  treesPlanted: number;
  carsRemoved: number;
  homesPowered: number;
  calculationStandard: string;
}

export interface ProgressGoal {
  target: number;
  achieved: number;
  percentage: number;
  projectedCompletionDate?: string;
}

export interface ProgressResponse {
  annual: ProgressGoal;
  netZero: ProgressGoal;
  onTrack: boolean;
  behindScheduleAlert: boolean;
  alertMessage?: string;
}

export interface RetirementAnalyticsSummaryResponse {
  purposeBreakdown: PurposeBreakdownResponse;
  trends: TrendsResponse;
  forecast: ForecastResponse;
  impact: ImpactResponse;
  progress: ProgressResponse;
}
