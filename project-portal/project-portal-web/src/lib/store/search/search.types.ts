// Search Types for Project Portal Search Service

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface ProjectDocument {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  region: string;
  country: string;
  location: GeoPoint;
  carbonCredits: number;
  pricePerTon: number;
  verificationStandard: string;
  methodology: string;
  vintage: number;
  sdgs: number[];
  coBenefits: string[];
  imageUrl: string;
  dynamicScore: number;
  lastVerification: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectType =
  | 'forestry'
  | 'renewable'
  | 'agriculture'
  | 'bluecarbon'
  | 'cookstoves'
  | 'methane'
  | 'other';

export type ProjectStatus = 'active' | 'pending' | 'completed' | 'suspended';

export type SortField = 'name' | 'createdAt' | 'carbonCredits' | 'pricePerTon' | 'dynamicScore';

export type SortOrder = 'asc' | 'desc';

export interface SearchFilters {
  projectType?: ProjectType[];
  region?: string[];
  status?: ProjectStatus[];
  minCarbonCredits?: number;
  maxCarbonCredits?: number;
  minPrice?: number;
  maxPrice?: number;
  minScore?: number;
  maxScore?: number;
  sdgs?: number[];
  verificationStandard?: string[];
}

export interface SearchRequest {
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  filters?: SearchFilters;
  region?: string;
  projectType?: string;
  status?: string;
}

export interface SearchNearbyRequest {
  lat: number;
  lon: number;
  distance?: number; // in km
  q?: string;
  page?: number;
  pageSize?: number;
  filters?: SearchFilters;
}

export interface SearchResponse {
  hits: ProjectDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: SearchFacets;
  executionTime: number;
  query: string;
}

export interface SearchFacets {
  projectTypes: FacetBucket[];
  regions: FacetBucket[];
  countries: FacetBucket[];
  statuses: FacetBucket[];
  verificationStandards: FacetBucket[];
  sdgs: FacetBucket[];
}

export interface FacetBucket {
  key: string;
  count: number;
  label?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  createdAt: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
}

export interface TypeaheadSuggestion {
  text: string;
  type: 'query' | 'project' | 'region';
  projectId?: string;
}

export interface SearchSlice {
  // Query and results
  query: string;
  results: ProjectDocument[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;

  // Filters and sorting
  searchFilters: SearchFilters;
  sortBy: SortField;
  sortOrder: SortOrder;

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Typeahead
  suggestions: TypeaheadSuggestion[];
  isLoadingSuggestions: boolean;

  // Facets
  facets: SearchFacets | null;

  // Recent searches
  recentSearches: RecentSearch[];

  // Saved searches
  savedSearches: SavedSearch[];

  // Geospatial
  nearbyResults: ProjectDocument[];
  userLocation: GeoPoint | null;

  // Core search actions
  search: (query?: string) => Promise<void>;
  searchNearby: (lat: number, lon: number, distance?: number) => Promise<void>;
  clearSearch: () => void;

  // Filter actions
  setSearchFilters: (filters: SearchFilters) => void;
  addFilter: (key: keyof SearchFilters, value: string | number | string[] | number[]) => void;
  removeFilter: (key: keyof SearchFilters, value?: string | number) => void;
  clearFilters: () => void;

  // Sorting actions
  setSorting: (sortBy: SortField, sortOrder: SortOrder) => void;

  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;

  // Saved searches
  saveSearch: (name: string) => void;
  loadSavedSearch: (savedSearch: SavedSearch) => void;
  deleteSavedSearch: (id: string) => void;

  // Recent searches
  addRecentSearch: (query: string, resultCount: number) => void;
  clearRecentSearches: () => void;

  // Typeahead
  fetchSuggestions: (query: string) => Promise<void>;
  clearSuggestions: () => void;

  // Geospatial
  setUserLocation: (location: GeoPoint) => void;
  clearNearbyResults: () => void;

  // Index sync (admin)
  syncIndex: () => Promise<void>;
}
