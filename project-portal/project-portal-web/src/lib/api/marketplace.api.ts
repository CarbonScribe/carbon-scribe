import { api } from './axios';

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
  currency?: string;
}

export interface MarketplaceSearchQuery {
  query?: string;
  methodology?: string;
  vintageFrom?: number;
  vintageTo?: number;
  sortBy?: 'price' | 'vintage' | 'popularity' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MarketplaceSearchResult {
  data: MarketplaceCredit[];
  total: number;
  page: number;
  limit: number;
  facets: {
    countries: Array<{ value: string | number; count: number }>;
    methodologies: Array<{ value: string | number; count: number }>;
    standards: Array<{ value: string | number; count: number }>;
    sdgs: Array<{ value: string | number; count: number }>;
    vintageYears: Array<{ value: string | number; count: number }>;
    priceRange: { min?: number; max?: number; median?: number };
  };
}

export async function searchMarketplaceCredits(
  params: MarketplaceSearchQuery,
  signal?: AbortSignal,
): Promise<MarketplaceSearchResult> {
  const response = await api.get<MarketplaceSearchResult>('/marketplace/search', {
    params,
    signal,
  });
  return response.data;
}
