export interface SbtiTarget {
  id: string;
  companyId: string;
  targetType: string;
  scope: string;
  baseYear: number;
  baseYearEmissions: number;
  targetYear: number;
  reductionPercentage: number;
  status: string;
  validationId?: string;
  validatedAt?: Date;
}
