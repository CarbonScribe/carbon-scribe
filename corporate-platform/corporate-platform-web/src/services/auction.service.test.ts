import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/services/api-client';
import { auctionService } from '@/services/auction.service';
import { Auction, Bid } from '@/types/auction';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAuction: Auction = {
  id: 'auction-1',
  creditId: 'credit-1',
  quantity: 1000,
  remaining: 750,
  startPrice: 50,
  currentPrice: 42,
  floorPrice: 20,
  priceDecrement: 2,
  decrementInterval: 30,
  startTime: '2026-05-01T09:00:00Z',
  endTime: '2026-05-01T18:00:00Z',
  lastPriceUpdate: '2026-05-01T10:00:00Z',
  status: 'active',
  createdAt: '2026-04-30T12:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
  credit: { id: 'credit-1', projectName: 'Amazon Reforestation', country: 'Brazil' },
};

const mockBid: Bid = {
  id: 'bid-1',
  auctionId: 'auction-1',
  userId: 'user-1',
  companyId: 'company-1',
  bidPrice: 42,
  quantity: 100,
  status: 'accepted',
  createdAt: '2026-05-01T10:30:00Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuctionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getAuctions ──────────────────────────────────────────────────────────

  describe('getAuctions', () => {
    it('calls GET /auctions and returns auction list on success', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: [mockAuction] });

      const result = await auctionService.getAuctions();

      expect(mockGet).toHaveBeenCalledWith('/auctions');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('auction-1');
    });

    it('propagates API failure response', async () => {
      mockGet.mockResolvedValueOnce({
        success: false,
        error: 'Unauthorized',
      });

      const result = await auctionService.getAuctions();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  // ── getAuctionById ────────────────────────────────────────────────────────

  describe('getAuctionById', () => {
    it('calls GET /auctions/:id with encoded id', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: mockAuction });

      const result = await auctionService.getAuctionById('auction-1');

      expect(mockGet).toHaveBeenCalledWith('/auctions/auction-1');
      expect(result.data?.currentPrice).toBe(42);
    });

    it('returns error response when auction not found', async () => {
      mockGet.mockResolvedValueOnce({
        success: false,
        error: 'Auction not found',
      });

      const result = await auctionService.getAuctionById('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auction not found');
    });
  });

  // ── getAuctionStatus ──────────────────────────────────────────────────────

  describe('getAuctionStatus', () => {
    it('delegates to getAuctionById (same endpoint)', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: mockAuction });

      const result = await auctionService.getAuctionStatus('auction-1');

      expect(mockGet).toHaveBeenCalledWith('/auctions/auction-1');
      expect(result.data?.status).toBe('active');
    });
  });

  // ── placeBid ──────────────────────────────────────────────────────────────

  describe('placeBid', () => {
    it('calls POST /auctions/:id/bids with payload', async () => {
      mockPost.mockResolvedValueOnce({ success: true, data: mockBid });

      const payload = { bidPrice: 42, quantity: 100 };
      const result = await auctionService.placeBid('auction-1', payload);

      expect(mockPost).toHaveBeenCalledWith(
        '/auctions/auction-1/bids',
        payload,
      );
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('accepted');
    });

    it('returns error when bid is rejected', async () => {
      mockPost.mockResolvedValueOnce({
        success: false,
        error: 'Bid price below floor price',
      });

      const result = await auctionService.placeBid('auction-1', {
        bidPrice: 5,
        quantity: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('floor price');
    });

    it('returns error for ended auction', async () => {
      mockPost.mockResolvedValueOnce({
        success: false,
        error: 'Auction has ended',
      });

      const result = await auctionService.placeBid('auction-ended', {
        bidPrice: 30,
        quantity: 5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auction has ended');
    });

    it('returns error for insufficient quantity', async () => {
      mockPost.mockResolvedValueOnce({
        success: false,
        error: 'Insufficient remaining quantity',
      });

      const result = await auctionService.placeBid('auction-1', {
        bidPrice: 42,
        quantity: 99999,
      });

      expect(result.success).toBe(false);
    });
  });

  // ── getAuctionBids ────────────────────────────────────────────────────────

  describe('getAuctionBids', () => {
    it('calls GET /auctions/:id/bids', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: [mockBid] });

      const result = await auctionService.getAuctionBids('auction-1');

      expect(mockGet).toHaveBeenCalledWith('/auctions/auction-1/bids');
      expect(result.data).toHaveLength(1);
      expect(result.data![0].bidPrice).toBe(42);
    });

    it('returns empty list when no bids exist', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: [] });

      const result = await auctionService.getAuctionBids('auction-1');

      expect(result.data).toHaveLength(0);
    });
  });

  // ── createAuction ─────────────────────────────────────────────────────────

  describe('createAuction', () => {
    it('calls POST /auctions with correct payload', async () => {
      const pendingAuction: Auction = {
        ...mockAuction,
        id: 'auction-new',
        status: 'pending',
      };
      mockPost.mockResolvedValueOnce({ success: true, data: pendingAuction });

      const payload = {
        creditId: 'credit-1',
        quantity: 500,
        startPrice: 60,
        floorPrice: 25,
        priceDecrement: 3,
        decrementInterval: 15,
        startTime: '2026-06-01T09:00:00Z',
        endTime: '2026-06-01T18:00:00Z',
      };

      const result = await auctionService.createAuction(payload);

      expect(mockPost).toHaveBeenCalledWith('/auctions', payload);
      expect(result.data?.status).toBe('pending');
    });
  });
});
