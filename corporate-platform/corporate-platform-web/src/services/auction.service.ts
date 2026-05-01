import { apiClient, ApiResponse } from './api-client';
import {
  Auction,
  Bid,
  PlaceBidPayload,
  CreateAuctionPayload,
} from '@/types/auction';

const BASE = '/auctions';

/**
 * Auction API Service
 * Integrates all backend Auction endpoints at /api/v1/auctions.
 */
class AuctionService {
  /** GET /auctions — list all auctions (includes active, ended, settled) */
  async getAuctions(): Promise<ApiResponse<Auction[]>> {
    return apiClient.get<Auction[]>(BASE);
  }

  /**
   * GET /auctions/:id — get full auction details.
   * The backend dynamically computes `currentPrice` for Dutch auctions.
   * Re-used as the "status" endpoint since it reflects live state.
   */
  async getAuctionById(id: string): Promise<ApiResponse<Auction>> {
    return apiClient.get<Auction>(`${BASE}/${encodeURIComponent(id)}`);
  }

  /**
   * GET /auctions/:id — alias for `getAuctionById`.
   * Maps to the issue's "GET /auction/:id/status" requirement.
   */
  async getAuctionStatus(id: string): Promise<ApiResponse<Auction>> {
    return this.getAuctionById(id);
  }

  /**
   * POST /auctions/:id/bids — place a bid on an active auction.
   * Authentication header is automatically included by the ApiClient.
   */
  async placeBid(
    id: string,
    payload: PlaceBidPayload,
  ): Promise<ApiResponse<Bid>> {
    return apiClient.post<Bid>(
      `${BASE}/${encodeURIComponent(id)}/bids`,
      payload,
    );
  }

  /** GET /auctions/:id/bids — retrieve the full bid history for an auction */
  async getAuctionBids(id: string): Promise<ApiResponse<Bid[]>> {
    return apiClient.get<Bid[]>(`${BASE}/${encodeURIComponent(id)}/bids`);
  }

  /** POST /auctions — create a new auction (admin / credit owner) */
  async createAuction(
    payload: CreateAuctionPayload,
  ): Promise<ApiResponse<Auction>> {
    return apiClient.post<Auction>(BASE, payload);
  }
}

export const auctionService = new AuctionService();
export default AuctionService;
