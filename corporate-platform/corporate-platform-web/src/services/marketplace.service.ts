import { apiClient, ApiResponse } from './api-client';
import {
  MarketplaceCredit,
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
  MarketplaceStats,
  MarketplaceFiltersData,
  CheckoutPayload,
  ConfirmCheckoutPayload,
  CheckoutOrder,
} from '@/types/marketplace';

/**
 * Marketplace API Service
 * Integrates all backend marketplace, credit, cart, and checkout endpoints.
 */
class MarketplaceService {
  // ── Discovery / Listing ─────────────────────────────────────────────────

  /** GET /marketplace/search – search and filter available credits */
  async searchCredits(
    query: MarketplaceSearchQuery,
  ): Promise<ApiResponse<MarketplaceSearchResult>> {
    const params = new URLSearchParams();

    if (query.query) params.set('query', query.query);
    if (query.projectName) params.set('projectName', query.projectName);
    if (query.country) params.set('country', query.country);
    if (query.methodology) params.set('methodology', query.methodology);
    if (query.standard) params.set('standard', query.standard);
    if (query.sdgs?.length)
      query.sdgs.forEach((s) => params.append('sdgs', String(s)));
    if (query.vintageFrom != null)
      params.set('vintageFrom', String(query.vintageFrom));
    if (query.vintageTo != null)
      params.set('vintageTo', String(query.vintageTo));
    if (query.priceMin != null) params.set('priceMin', String(query.priceMin));
    if (query.priceMax != null) params.set('priceMax', String(query.priceMax));
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);
    if (query.page != null) params.set('page', String(query.page));
    if (query.limit != null) params.set('limit', String(query.limit));

    const qs = params.toString();
    return apiClient.get<MarketplaceSearchResult>(
      `/marketplace/search${qs ? `?${qs}` : ''}`,
    );
  }

  /** GET /credits/:id – get a single credit's full details */
  async getCreditById(id: string): Promise<ApiResponse<MarketplaceCredit>> {
    return apiClient.get<MarketplaceCredit>(
      `/credits/${encodeURIComponent(id)}`,
    );
  }

  /** GET /marketplace/featured – featured credits */
  async getFeaturedCredits(): Promise<ApiResponse<MarketplaceCredit[]>> {
    return apiClient.get<MarketplaceCredit[]>('/marketplace/featured');
  }

  /** GET /marketplace/trending – trending credits by view/purchase count */
  async getTrendingCredits(): Promise<ApiResponse<MarketplaceCredit[]>> {
    return apiClient.get<MarketplaceCredit[]>('/marketplace/trending');
  }

  /** GET /marketplace/new – newest credits */
  async getNewestCredits(): Promise<ApiResponse<MarketplaceCredit[]>> {
    return apiClient.get<MarketplaceCredit[]>('/marketplace/new');
  }

  /** GET /marketplace/similar/:creditId – credits similar to a given one */
  async getSimilarCredits(
    creditId: string,
  ): Promise<ApiResponse<MarketplaceCredit[]>> {
    return apiClient.get<MarketplaceCredit[]>(
      `/marketplace/similar/${encodeURIComponent(creditId)}`,
    );
  }

  /** GET /marketplace/recommendations – personalised recommendations */
  async getRecommendations(
    sdgs?: number[],
  ): Promise<ApiResponse<MarketplaceCredit[]>> {
    const params =
      sdgs && sdgs.length > 0 ? `?sdgs=${sdgs.join(',')}` : '';
    return apiClient.get<MarketplaceCredit[]>(
      `/marketplace/recommendations${params}`,
    );
  }

  /** GET /marketplace/discovery – discovery overview sections */
  async getDiscovery(): Promise<ApiResponse<unknown>> {
    return apiClient.get('/marketplace/discovery');
  }

  /** GET /marketplace/stats – aggregated marketplace statistics */
  async getStats(): Promise<ApiResponse<MarketplaceStats>> {
    return apiClient.get<MarketplaceStats>('/marketplace/stats');
  }

  /** GET /marketplace/filters – available filter values */
  async getFilters(): Promise<ApiResponse<MarketplaceFiltersData>> {
    return apiClient.get<MarketplaceFiltersData>('/marketplace/filters');
  }

  // ── Cart ────────────────────────────────────────────────────────────────

  /** POST /cart/items – add a credit to the server-side cart */
  async addToCartServer(
    creditId: string,
    quantity?: number,
  ): Promise<ApiResponse<unknown>> {
    return apiClient.post('/cart/items', { creditId, quantity });
  }

  /** DELETE /cart/items/:itemId – remove a specific item from server cart */
  async removeFromCartServer(itemId: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete(`/cart/items/${encodeURIComponent(itemId)}`);
  }

  /** DELETE /cart – clear all items from server cart */
  async clearCartServer(): Promise<ApiResponse<unknown>> {
    return apiClient.delete('/cart');
  }

  /** GET /cart – get current server-side cart */
  async getServerCart(): Promise<ApiResponse<unknown>> {
    return apiClient.get('/cart');
  }

  // ── Checkout ────────────────────────────────────────────────────────────

  /** POST /cart/checkout – initiate checkout; returns a pending order */
  async checkout(payload: CheckoutPayload): Promise<ApiResponse<CheckoutOrder>> {
    return apiClient.post<CheckoutOrder>('/cart/checkout', payload);
  }

  /** POST /checkout/confirm – confirm and complete a pending order */
  async confirmPurchase(
    payload: ConfirmCheckoutPayload,
  ): Promise<ApiResponse<CheckoutOrder>> {
    return apiClient.post<CheckoutOrder>('/checkout/confirm', payload);
  }
}

export const marketplaceService = new MarketplaceService();
export default MarketplaceService;
