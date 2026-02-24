// Search API Client for Project Portal Search Service

import apiClient from '@/lib/api/apiClient';
import type {
  SearchRequest,
  SearchNearbyRequest,
  SearchResponse,
  TypeaheadSuggestion,
  SearchFilters,
} from './search.types';

class SearchApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'SearchApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new SearchApiError(
      `Search API error: ${response.statusText}`,
      response.status,
      response.statusText
    );
  }
  return response.json();
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          searchParams.set(key, value.join(','));
        }
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects like filters
        const nestedParams = buildNestedParams(key, value as Record<string, unknown>);
        nestedParams.forEach(([nestedKey, nestedValue]) => {
          searchParams.set(nestedKey, String(nestedValue));
        });
      } else {
        searchParams.set(key, String(value));
      }
    }
  });

  return searchParams.toString();
}

function buildNestedParams(prefix: string, obj: Record<string, unknown>): [string, unknown][] {
  const params: [string, unknown][] = [];

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const paramKey = `${prefix}[${key}]`;
      if (Array.isArray(value)) {
        if (value.length > 0) {
          params.push([paramKey, value.join(',')]);
        }
      } else if (typeof value === 'object') {
        params.push(...buildNestedParams(paramKey, value as Record<string, unknown>));
      } else {
        params.push([paramKey, value]);
      }
    }
  });

  return params;
}

/**
 * Perform a text search for carbon projects
 */
export async function searchProjects(request: SearchRequest): Promise<SearchResponse> {
  const {
    q,
    page = 1,
    pageSize = 12,
    sortBy,
    sortOrder,
    filters,
    region,
    projectType,
    status,
  } = request;

  const params: Record<string, unknown> = {
    q: q || '',
    page,
    page_size: pageSize,
  };

  if (sortBy) params.sort_by = sortBy;
  if (sortOrder) params.sort_order = sortOrder;
  if (region) params.region = region;
  if (projectType) params.project_type = projectType;
  if (status) params.status = status;
  if (filters) params.filters = filters;

  const queryString = buildQueryString(params);
  const url = `/search?${queryString}`;

  const response = await apiClient.get<SearchResponse>(url, {
    params: undefined, // Clear default params since we're building the URL manually
  });

  return response.data;
}

/**
 * Perform a geospatial search for nearby carbon projects
 */
export async function searchNearbyProjects(request: SearchNearbyRequest): Promise<SearchResponse> {
  const {
    lat,
    lon,
    distance = 50,
    q,
    page = 1,
    pageSize = 12,
    filters,
  } = request;

  const params: Record<string, unknown> = {
    lat,
    lon,
    dist: distance,
    page,
    page_size: pageSize,
  };

  if (q) params.q = q;
  if (filters) params.filters = filters;

  const queryString = buildQueryString(params);
  const url = `/search/nearby?${queryString}`;

  const response = await apiClient.get<SearchResponse>(url, {
    params: undefined,
  });

  return response.data;
}

/**
 * Fetch typeahead/suggestions based on user input
 */
export async function fetchSuggestions(query: string): Promise<TypeaheadSuggestion[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const params = new URLSearchParams({ q: query });
  const url = `/search/suggestions?${params}`;

  try {
    const response = await apiClient.get<TypeaheadSuggestion[]>(url);
    return response.data || [];
  } catch {
    // Return empty array for suggestions errors - not critical
    return [];
  }
}

/**
 * Trigger index sync (admin only)
 */
export async function syncSearchIndex(): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    '/search/index/sync'
  );
  return response.data;
}

/**
 * Build filter query string for API calls
 */
export function buildFilterParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.projectType?.length) {
    params.project_type = filters.projectType.join(',');
  }
  if (filters.region?.length) {
    params.region = filters.region.join(',');
  }
  if (filters.status?.length) {
    params.status = filters.status.join(',');
  }
  if (filters.minCarbonCredits !== undefined) {
    params.min_carbon_credits = String(filters.minCarbonCredits);
  }
  if (filters.maxCarbonCredits !== undefined) {
    params.max_carbon_credits = String(filters.maxCarbonCredits);
  }
  if (filters.minPrice !== undefined) {
    params.min_price = String(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    params.max_price = String(filters.maxPrice);
  }
  if (filters.minScore !== undefined) {
    params.min_score = String(filters.minScore);
  }
  if (filters.maxScore !== undefined) {
    params.max_score = String(filters.maxScore);
  }
  if (filters.sdgs?.length) {
    params.sdgs = filters.sdgs.join(',');
  }
  if (filters.verificationStandard?.length) {
    params.verification_standard = filters.verificationStandard.join(',');
  }

  return params;
}
