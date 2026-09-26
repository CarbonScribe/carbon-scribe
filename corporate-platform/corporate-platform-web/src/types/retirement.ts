export type RetirementPurpose =
  | 'scope1'
  | 'scope2'
  | 'scope3'
  | 'corporate'
  | 'events'
  | 'product';

/**
 * Reporting frameworks a retirement can be attributed to. Shown on the
 * pre-commit review step so the user can see what this irreversible action will
 * count toward before confirming (#512).
 */
export type ReportingFramework =
  | 'ghg-protocol'
  | 'csrd'
  | 'cdp'
  | 'sbti'
  | 'corsia'
  | 'cbam'
  | 'none';

export interface RetireCreditsPayload {
  creditId: string;
  amount: number;
  purpose: RetirementPurpose;
  purposeDetails?: string;
  /**
   * Wallet the retirement is executed from. Defaults to the authenticated
   * company's wallet when the caller does not override it.
   *
   * Backend dependency: `POST /retirements` must accept and persist these
   * fields; until it does they are review-only and are ignored server-side.
   */
  beneficiaryWallet?: string;
  /** Entity credited with the retirement (defaults to the company). */
  beneficiaryName?: string;
  /** Framework this retirement is reported under. */
  reportingFramework?: ReportingFramework;
  /** Reporting period the retirement is attributed to (e.g. "FY2026 Q1"). */
  reportingPeriod?: string;
}

/**
 * Everything shown on the pre-commit review step. Derived from the form state
 * plus context (company, wallet) so the user reviews the exact effect of the
 * action rather than just the raw inputs.
 */
export interface RetirementReviewSummary {
  creditId: string;
  creditProjectName: string;
  creditCountry?: string;
  pricePerTon?: number;
  amount: number;
  estimatedValue?: number;
  purpose: RetirementPurpose;
  purposeLabel: string;
  purposeDetails?: string;
  beneficiaryName: string;
  beneficiaryWallet: string;
  reportingFramework: ReportingFramework;
  reportingFrameworkLabel: string;
  reportingPeriod?: string;
}

export interface RetirementCredit {
  id: string;
  projectName: string;
  country?: string;
  vintage?: number;
}

export interface RetirementCompany {
  id: string;
  name: string;
}

export interface RetirementRecord {
  id: string;
  companyId: string;
  userId: string;
  creditId: string;
  amount: number;
  purpose: RetirementPurpose;
  purposeDetails?: string | null;
  priceAtRetirement: number;
  retiredAt: string;
  certificateId?: string | null;
  transactionHash?: string | null;
  transactionUrl?: string | null;
  verifiedAt?: string | null;
  credit?: RetirementCredit;
  company?: RetirementCompany;
  /**
   * Wallet/beneficiary and reporting attribution echoed back by the API.
   *
   * Backend dependency: these are populated only once `POST /retirements`
   * persists the corresponding fields; they are optional so the receipt screen
   * renders unchanged against the current API.
   */
  beneficiaryWallet?: string | null;
  beneficiaryName?: string | null;
  reportingFramework?: ReportingFramework | null;
  reportingPeriod?: string | null;
}

export interface RetirementStats {
  totalRetired: number;
  byPurpose: Record<RetirementPurpose, number>;
  monthlyTrend: { month: string; amount: number }[];
}

export interface RetirementHistoryQuery {
  startDate?: string;
  endDate?: string;
  purpose?: RetirementPurpose;
  creditProject?: string;
  page?: number;
  limit?: number;
}

export interface RetirementHistoryMeta {
  total: number;
  page: number;
  limit: number;
}

export interface RetirementHistoryResponse {
  data: RetirementRecord[];
  meta: RetirementHistoryMeta;
}

export interface RetirementValidationResult {
  valid: boolean;
  availableBalance: number;
  requestedAmount: number;
  errors?: string[];
}

export interface EntityCertificate {
  id: string;
  certificateId: string;
  companyName: string;
  creditProject: string;
  creditAmount: number;
  purpose: RetirementPurpose;
  retiredAt: string;
  transactionHash?: string | null;
  certificateUrl: string;
}
