export interface QualityRadarData {
  projectId: string;
  projectName: string;
  overallScore: number; // 0-100
  dimensions: QualityDimension[];
  riskFactors: RiskFactor[];
  benchmarkComparison: BenchmarkComparison;
  lastUpdated: Date;
}

export interface QualityDimension {
  name:
    | 'permanence'
    | 'additionality'
    | 'verification'
    | 'leakage'
    | 'cobenefits'
    | 'transparency';
  score: number; // 0-100
  weight: number; // 0-1
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
  percentile: number; // 0-100 within region/industry
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
  excellent: number; // 80-100
  good: number; // 60-79
  fair: number; // 40-59
  poor: number; // 0-39
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
  date: Date;
  score: number;
  sampleSize: number;
}
