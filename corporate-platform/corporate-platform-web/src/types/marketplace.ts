export type MarketplaceSortBy = 'price' | 'vintage' | 'popularity' | 'createdAt';
export type MarketplaceSortOrder = 'asc' | 'desc';

export interface MarketplaceSearchQuery {
  query?: string;
  projectName?: string;
  country?: string;
  methodology?: string;
  standard?: string;
  sdgs?: number[];
  vintageFrom?: number;
  vintageTo?: number;
  priceMin?: number;
  priceMax?: number;
  sortBy?: MarketplaceSortBy;
  sortOrder?: MarketplaceSortOrder;
  page?: number;
  limit?: number;
}

export interface MarketplaceFacetValue {
  value: string | number;
  count: number;
}

export interface MarketplaceSearchFacets {
  countries: MarketplaceFacetValue[];
  methodologies: MarketplaceFacetValue[];
  standards: MarketplaceFacetValue[];
  sdgs: MarketplaceFacetValue[];
  vintageYears: MarketplaceFacetValue[];
  priceRange: { min?: number; max?: number; median?: number };
}

export interface MarketplaceSearchResult {
  data: MarketplaceCredit[];
  total: number;
  page: number;
  limit: number;
  facets: MarketplaceSearchFacets;
}

/** Shape returned by the backend Credit model */
export interface MarketplaceCredit {
  id: string;
  projectId: string;
  projectName: string;
  country?: string;
  methodology?: string;
  vintage?: number;
  availableAmount: number;
  totalAmount: number;
  pricePerTon: number;
  status: string;
  verificationStandard?: string;
  sdgs: number[];
  dynamicScore: number;
  lastVerification?: string;
  featured?: boolean;
  viewCount?: number;
  purchaseCount?: number;
  // optional enrichment fields
  currency?: string;
  imageUrl?: string;
  coBenefits?: string[];
}

export interface MarketplaceStats {
  totalCredits: number;
  avgPrice?: number;
  projectCount: number;
  countryCount: number;
  methodologyCount: number;
  price: { min?: number; max?: number; median?: number };
}

export interface MarketplaceFiltersData {
  methodologies: string[];
  countries: string[];
  sdgs: number[];
  vintageRange: { min?: number; max?: number };
  priceRange: { min?: number; max?: number };
}

export interface LocalFilterState {
  query: string;
  priceRange: [number, number];
  methodologies: string[];
  countries: string[];
  sdgs: number[];
  vintage: [number, number];
  sortBy: MarketplaceSortBy | '';
  sortOrder: MarketplaceSortOrder;
}

export type PaymentMethod = 'credit_card' | 'wire' | 'crypto';

export interface CheckoutPayload {
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface ConfirmCheckoutPayload {
  orderId: string;
  paymentId?: string;
}

export interface CheckoutOrder {
  id: string;
  status: string;
  total?: number;
  createdAt?: string;
}
