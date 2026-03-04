export interface CreditQuality {
  dynamicScore: number;
  verificationScore: number;
  additionalityScore: number;
  permanenceScore: number;
  leakageScore: number;
  cobenefitsScore: number;
  transparencyScore: number;
}

export interface CreditComparison {
  projectId: string;
  projectName: string;
  pricePerTon: number;
  dynamicScore: number;
  country: string;
  methodology: string;
}

export interface CreditStats {
  totalAvailable: number;
  averagePrice: number;
  projectCount: number;
  methodologyBreaksdown: Record<string, number>;
}
