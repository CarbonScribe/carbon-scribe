// Dashboard Analytics Types

export interface DashboardOverview {
  totalProjects: number;
  activeProjects: number;
  totalCreditsRetired: number;
  totalCreditsAvailable: number;
  averageQualityScore: number;
  monthlyRetirementTarget: number;
  monthlyRetirementProgress: number;
  retirementProgressPercentage: number;
  topRegions: RegionalMetric[];
  topProjectTypes: ProjectTypeMetric[];
  recentActivity: ActivityMetric[];
}

export interface DashboardInsights {
  anomalies: Anomaly[];
  trends: Trend[];
  recommendations: Recommendation[];
  riskAlerts: RiskAlert[];
}

export interface Anomaly {
  type: 'spike' | 'drop' | 'trend_change';
  metric: string;
  value: number;
  expectedValue: number;
  deviance: number;
  date: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Trend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  percentageChange: number;
  period: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface RiskAlert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedProjects: string[];
}

export interface RegionalMetric {
  region: string;
  projectCount: number;
  creditsRetired: number;
  avgQualityScore: number;
  growthRate: number;
}

export interface ProjectTypeMetric {
  type: string;
  count: number;
  totalCredits: number;
  avgQualityScore: number;
}

export interface ActivityMetric {
  date: string;
  creditsRetired: number;
  newProjects: number;
  averageScore: number;
}

// Predictive Analytics Types

export interface PredictiveInsights {
  forecast: ForecastData[];
  confidence: number;
  methodology: string;
  lastUpdated: string;
}

export interface ForecastData {
  date: string;
  predictedValue: number;
  confidenceInterval: ConfidenceInterval;
  scenario: 'optimistic' | 'pessimistic' | 'realistic';
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
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
  strength: number;
  seasonality: boolean;
  anomalies: TrendAnomaly[];
}

export interface SeasonalPattern {
  pattern: number[];
  period: number;
  strength: number;
}

export interface TrendAnomaly {
  date: string;
  value: number;
  expectedValue: number;
  deviation: number;
}

// Quality Analytics Types

export interface QualityRadarData {
  projectId: string;
  projectName: string;
  overallScore: number;
  dimensions: QualityDimension[];
  riskFactors: RiskFactor[];
  benchmarkComparison: BenchmarkComparison;
  lastUpdated: string;
}

export interface QualityDimension {
  name: 'permanence' | 'additionality' | 'verification' | 'leakage' | 'cobenefits' | 'transparency';
  score: number;
  weight: number;
  description: string;
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation?: string;
}

export interface BenchmarkComparison {
  projectScore: number;
  industryAverage: number;
  regionAverage: number;
  percentile: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface PortfolioQualityScore {
  portfolioId: string;
  companyId: string;
  compositScore: number;
  scoresByDimension: Record<string, number>;
  topRisks: RiskFactor[];
  projectCount: number;
  qualityDistribution: QualityDistribution;
}

export interface QualityDistribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

export interface IndustryBenchmark {
  industry: string;
  region: string;
  averageScore: number;
  medianScore: number;
  percentile: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  trendData: BenchmarkTrend[];
}

export interface BenchmarkTrend {
  date: string;
  score: number;
  sampleSize: number;
}

// Performance Analytics Types

export interface PerformanceTimeSeries {
  metric: string;
  data: TimeSeriesPoint[];
  comparison?: TimeSeriesComparison;
  aggregation: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface TimeSeriesPoint {
  date: string;
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

// Project Comparison Types

export interface ProjectComparison {
  projects: ComparedProject[];
  metrics: ComparisonMetric[];
}

export interface ComparedProject {
  id: string;
  name: string;
  type: string;
  region: string;
  qualityScore: number;
  creditsAvailable: number;
  pricePerCredit: number;
}

export interface ComparisonMetric {
  name: string;
  values: Record<string, number>;
}

export interface SimilarProject {
  id: string;
  name: string;
  similarity: number;
  type: string;
  region: string;
  qualityScore: number;
}

export interface ProjectOutlier {
  projectId: string;
  projectName: string;
  metric: string;
  value: number;
  mean: number;
  standardDeviation: number;
  zScore: number;
  direction: 'above' | 'below';
}
