export interface IProgressMetrics {
  targetId: string;
  targetType: string;
  scope: string;
  baseYear: number;
  baseYearEmissions: number;
  targetYear: number;
  reductionPercentage: number;
  currentYear: number;
  currentEmissions: number;
  targetEmissionsForCurrentYear: number;
  requiredAnnualReductionRate: number;
  actualReductionToDate: number;
  onTrack: boolean;
  progressPercentage: number;
  yearlyBreakdown: IYearlyProgressPoint[];
}

export interface IYearlyProgressPoint {
  year: number;
  targetEmissions: number;
  actualEmissions?: number;
  onTrack?: boolean;
}

export interface IDashboardMetrics {
  totalTargets: number;
  approvedTargets: number;
  onTrackTargets: number;
  nearTermCoverage: boolean;
  longTermCoverage: boolean;
  netZeroCoverage: boolean;
  overallComplianceScore: number;
  targets: IDashboardTargetSummary[];
}

export interface IDashboardTargetSummary {
  id: string;
  targetType: string;
  scope: string;
  status: string;
  targetYear: number;
  reductionPercentage: number;
  progressPercentage: number;
  onTrack: boolean;
}

export interface IRetirementGapResult {
  companyId: string;
  calculatedAt: string;
  gapAnalysis: ITargetGap[];
  totalGapTonnes: number;
  totalRetiredToDateTonnes: number;
  recommendedAnnualRetirements: number;
}

export interface ITargetGap {
  targetId: string;
  targetType: string;
  scope: string;
  targetYear: number;
  requiredReductionTonnes: number;
  actualRetiredTonnes: number;
  remainingGapTonnes: number;
  yearsRemaining: number;
  annualRetirementNeeded: number;
}
