export interface CorsiaEligibleCreditResult {
  retirementId: string;
  program: string;
  creditType: string;
  vintageYear: number;
  eligible: boolean;
  eligibilityMemo?: string;
  reasons?: string[];
}
