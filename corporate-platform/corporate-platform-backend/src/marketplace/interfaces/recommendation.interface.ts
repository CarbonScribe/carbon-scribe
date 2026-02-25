export interface MarketplaceUserProfile {
  userId: string;
  companyId: string;
  preferredCountries?: string[];
  preferredMethodologies?: string[];
  preferredSdgs?: number[];
}

export interface RecommendationOptions {
  sdgs?: number[];
  limit?: number;
}
