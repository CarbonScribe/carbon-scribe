export type RetirementPurpose =
  | 'scope1'
  | 'scope2'
  | 'scope3'
  | 'corporate'
  | 'events'
  | 'product';

export interface RetirementDetails {
  id: string;
  companyId: string;
  userId: string;
  creditId: string;
  amount: number;
  purpose: RetirementPurpose;
  purposeDetails?: string;
  priceAtRetirement: number;
  retiredAt: Date;
  certificateId?: string;
  transactionHash?: string;
}

export interface RetirementStats {
  totalRetired: number;
  byPurpose: Record<RetirementPurpose, number>;
  monthlyTrend: { month: string; amount: number }[];
}
