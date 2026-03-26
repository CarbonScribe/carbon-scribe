export interface CreditSummary {
  id: string;
  projectId: string;
  projectName: string;
  pricePerTon: number;
  availableAmount: number;
  totalAmount: number;
  status: string;
  country?: string | null;
  methodology?: string | null;
  vintage?: number | null;
  dynamicScore?: number;
}

export interface CreditDetail extends CreditSummary {
  sdgs: number[];
  verificationStandard?: string | null;
  lastVerification?: Date | null;
  assetCode?: string | null;
  issuer?: string | null;
  contractId?: string | null;
}
