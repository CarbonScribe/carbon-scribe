export interface PredictiveInsights {
  forecast: ForecastData[];
  confidence: number;
  methodology: string;
  lastUpdated: Date;
}

export interface ForecastData {
  date: Date;
  predictedValue: number;
  confidenceInterval: ConfidenceInterval;
  scenario: 'optimistic' | 'pessimistic' | 'realistic';
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number; // 95, 99, etc.
}

export interface RetirementForecast extends PredictiveInsights {
  projectedRetirements: number;
  seasonalPattern: SeasonalPattern;
}

export interface ImpactForecast extends PredictiveInsights {
  projectedCarbonReduction: number;
  projectedCost: number;
  roi: number;
}

export interface TrendDetection {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  strength: number; // 0-1
  seasonality: boolean;
  anomalies: TrendAnomaly[];
}

export interface SeasonalPattern {
  pattern: number[];
  period: number; // months
  strength: number; // 0-1
}

export interface TrendAnomaly {
  date: Date;
  value: number;
  expectedValue: number;
  deviation: number;
}

export interface ScenarioProjection {
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
  projectedValue: number;
  probability: number;
  assumptions: string[];
}
