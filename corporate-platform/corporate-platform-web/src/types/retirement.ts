export type RetirementPurpose =
  | 'scope1'
  | 'scope2'
  | 'scope3'
  | 'corporate'
  | 'events'
  | 'product';

export interface RetireCreditsPayload {
  creditId: string;
  amount: number;
  purpose: RetirementPurpose;
  purposeDetails?: string;
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
