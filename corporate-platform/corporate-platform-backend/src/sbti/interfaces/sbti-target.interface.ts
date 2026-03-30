export type SbtiTargetType = 'NEAR_TERM' | 'LONG_TERM' | 'NET_ZERO';
export type SbtiScope = 'SCOPE1' | 'SCOPE2' | 'SCOPE3' | 'ALL';
export type SbtiTargetStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'APPROVED';

export interface ISbtiTarget {
  id: string;
  companyId: string;
  targetType: SbtiTargetType;
  scope: SbtiScope;
  baseYear: number;
  baseYearEmissions: number;
  targetYear: number;
  reductionPercentage: number;
  status: SbtiTargetStatus;
  validationId?: string | null;
  validatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISbtiValidationResult {
  isValid: boolean;
  criteria: ISbtiCriteriaCheck[];
  overallScore: number;
  recommendations: string[];
}

export interface ISbtiCriteriaCheck {
  criterion: string;
  passed: boolean;
  detail: string;
}

export interface ISbtiSubmissionPackage {
  submissionId: string;
  companyId: string;
  generatedAt: string;
  targets: ISbtiTarget[];
  validationSummary: ISbtiValidationResult[];
  progressRecords: ITargetProgressRecord[];
  status: string;
}

export interface ITargetProgressRecord {
  targetId: string;
  reportingYear: number;
  emissions: number;
  targetEmissions: number;
  variance: number;
  onTrack: boolean;
}
