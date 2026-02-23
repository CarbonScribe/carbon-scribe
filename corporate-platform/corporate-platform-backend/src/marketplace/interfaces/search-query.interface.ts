export type MarketplaceSortBy =
  | 'price'
  | 'vintage'
  | 'popularity'
  | 'createdAt';

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
  priceRange: {
    min?: number;
    max?: number;
    median?: number;
  };
}

export interface MarketplaceSearchResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  facets: MarketplaceSearchFacets;
}
