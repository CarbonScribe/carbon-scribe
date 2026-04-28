// Credit Listing Types

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

export interface CreditListResponse {
  credits: CreditSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Credit Detail Types

export interface CreditDetail extends CreditSummary {
  sdgs: number[];
  verificationStandard?: string | null;
  lastVerification?: string | null;
  assetCode?: string | null;
  issuer?: string | null;
  contractId?: string | null;
  description?: string;
  projectType?: string;
  registryUrl?: string;
}

// Credit Quality Types

export interface CreditQualityBreakdown {
  dynamicScore: number;
  verificationScore: number;
  additionalityScore: number;
  permanenceScore: number;
  leakageScore: number;
  cobenefitsScore: number;
  transparencyScore: number;
}

export interface QualityRating {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
}

// Credit Comparison Types

export interface ComparisonPoint {
  projectId: string;
  projectName: string;
  pricePerTon: number;
  dynamicScore: number;
  country?: string | null;
  methodology?: string | null;
  vintage?: number | null;
}

export interface ComparisonResult {
  points: ComparisonPoint[];
  avgPrice: number;
  avgScore: number;
}

// Filter Types

export interface CreditFilters {
  methodologies: string[];
  countries: string[];
  vintages: number[];
}

// Query Types

export interface CreditQueryParams {
  page?: number;
  limit?: number;
  methodology?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  vintage?: number;
  sdgs?: number[];
  sort?: string;
  search?: string;
}

// Statistics Types

export interface CreditStats {
  totalCredits: number;
  availableCredits: number;
  avgPrice: number;
  avgQualityScore: number;
  totalValue: number;
  byMethodology: Record<string, number>;
  byCountry: Record<string, number>;
  byVintage: Record<string, number>;
}

// SDG Information

export interface SDGInfo {
  goal: number;
  name: string;
  icon: string;
  description: string;
}

// Available Credits Response

export interface AvailableCreditsResponse {
  credits: CreditSummary[];
  total: number;
  page: number;
  limit: number;
}
