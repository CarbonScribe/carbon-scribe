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
  date: Date;
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
  date: Date;
  creditsRetired: number;
  newProjects: number;
  averageScore: number;
}
