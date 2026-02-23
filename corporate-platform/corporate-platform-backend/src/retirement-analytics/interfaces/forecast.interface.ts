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
