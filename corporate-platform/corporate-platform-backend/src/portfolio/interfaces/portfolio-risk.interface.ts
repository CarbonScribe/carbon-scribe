export interface ConcentrationAnalysis {
  topProject: {
    name: string;
    percentage: number;
  };
  topCountry: {
    name: string;
    percentage: number;
  };
  herfindahlIndex: number;
}

export interface QualityDistribution {
  highQuality: number;
  mediumQuality: number;
  lowQuality: number;
}

export interface RiskMetrics {
  diversificationScore: number;
  riskRating: 'Low' | 'Medium' | 'High';
  concentrationAnalysis: ConcentrationAnalysis;
  volatility: number;
  projectQualityDistribution: QualityDistribution;
}

export interface PortfolioRiskResponse {
  success: boolean;
  data: RiskMetrics;
  timestamp: Date;
}
