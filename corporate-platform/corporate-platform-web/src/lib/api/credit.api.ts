import { authApiClient } from '@/lib/api/auth-http';
import type {
  CreditListResponse,
  CreditDetail,
  CreditQualityBreakdown,
  ComparisonResult,
  CreditFilters,
  CreditQueryParams,
  CreditStats,
  AvailableCreditsResponse,
} from '@/types/credit.types';

const CREDITS_PREFIX = '/api/v1/credits';

/**
 * List all credits with filtering and pagination
 */
export async function listCredits(params: CreditQueryParams = {}): Promise<CreditListResponse> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.methodology) queryParams.set('methodology', params.methodology);
  if (params.country) queryParams.set('country', params.country);
  if (params.minPrice) queryParams.set('minPrice', params.minPrice.toString());
  if (params.maxPrice) queryParams.set('maxPrice', params.maxPrice.toString());
  if (params.vintage) queryParams.set('vintage', params.vintage.toString());
  if (params.sdgs) queryParams.set('sdgs', params.sdgs.join(','));
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.search) queryParams.set('search', params.search);

  const queryString = queryParams.toString();
  const path = queryString ? `${CREDITS_PREFIX}?${queryString}` : CREDITS_PREFIX;

  return authApiClient.get<CreditListResponse>(path);
}

/**
 * List available credits for purchase
 */
export async function getAvailableCredits(
  page: number = 1,
  limit: number = 20
): Promise<AvailableCreditsResponse> {
  return authApiClient.get<AvailableCreditsResponse>(
    `${CREDITS_PREFIX}/available?page=${page}&limit=${limit}`
  );
}

/**
 * Get available filter options
 */
export async function getCreditFilters(): Promise<CreditFilters> {
  return authApiClient.get<CreditFilters>(`${CREDITS_PREFIX}/filters`);
}

/**
 * Get credit statistics
 */
export async function getCreditStats(): Promise<CreditStats> {
  return authApiClient.get<CreditStats>(`${CREDITS_PREFIX}/stats`);
}

/**
 * Compare multiple credits
 */
export async function compareCredits(projectIds: string[]): Promise<ComparisonResult> {
  return authApiClient.get<ComparisonResult>(
    `${CREDITS_PREFIX}/comparison?projectIds=${projectIds.join(',')}`
  );
}

/**
 * Get detailed information about a specific credit
 */
export async function getCreditDetail(creditId: string): Promise<CreditDetail> {
  return authApiClient.get<CreditDetail>(`${CREDITS_PREFIX}/${creditId}`);
}

/**
 * Get quality metrics for a specific credit
 */
export async function getCreditQuality(creditId: string): Promise<CreditQualityBreakdown> {
  return authApiClient.get<CreditQualityBreakdown>(`${CREDITS_PREFIX}/${creditId}/quality`);
}
