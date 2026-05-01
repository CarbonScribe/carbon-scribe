import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuctionList, useAuctionDetail } from '@/hooks/useAuction';
import { auctionService } from '@/services/auction.service';
import { Auction, Bid } from '@/types/auction';

vi.mock('@/services/auction.service', () => ({
  auctionService: {
    getAuctions: vi.fn(),
    getAuctionById: vi.fn(),
    getAuctionBids: vi.fn(),
    getAuctionStatus: vi.fn(),
    placeBid: vi.fn(),
  },
}));

const mockGetAuctions = vi.mocked(auctionService.getAuctions);
const mockGetAuctionById = vi.mocked(auctionService.getAuctionById);
const mockGetAuctionBids = vi.mocked(auctionService.getAuctionBids);
const mockGetAuctionStatus = vi.mocked(auctionService.getAuctionStatus);
const mockPlaceBid = vi.mocked(auctionService.placeBid);

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

// ── useAuctionList ────────────────────────────────────────────────────────────

describe('useAuctionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuctions.mockResolvedValue({ success: true, data: [mockAuction] });
  });

  it('fetches auctions on mount and sets loading then data', async () => {
    const { result } = renderHook(() => useAuctionList());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.auctions).toHaveLength(1);
    expect(result.current.auctions[0].id).toBe('auction-1');
    expect(result.current.error).toBeNull();
  });

  it('sets error when API call fails', async () => {
    mockGetAuctions.mockResolvedValueOnce({
      success: false,
      error: 'Server error',
    });

    const { result } = renderHook(() => useAuctionList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.auctions).toHaveLength(0);
    expect(result.current.error).toBe('Server error');
  });

  it('refetches on refresh', async () => {
    const { result } = renderHook(() => useAuctionList());

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetAuctions.mockResolvedValueOnce({ success: true, data: [] });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAuctions).toHaveBeenCalledTimes(2);
    expect(result.current.auctions).toHaveLength(0);
  });
});

// ── useAuctionDetail ──────────────────────────────────────────────────────────

describe('useAuctionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuctionById.mockResolvedValue({ success: true, data: mockAuction });
    mockGetAuctionBids.mockResolvedValue({ success: true, data: [mockBid] });
    mockGetAuctionStatus.mockResolvedValue({ success: true, data: mockAuction });
  });

  it('fetches auction and bids on mount', async () => {
    const { result } = renderHook(() => useAuctionDetail('auction-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.auction?.id).toBe('auction-1');
    expect(result.current.bids).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error when auction not found', async () => {
    mockGetAuctionById.mockResolvedValueOnce({
      success: false,
      error: 'Auction not found',
    });

    const { result } = renderHook(() => useAuctionDetail('bad-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.auction).toBeNull();
    expect(result.current.error).toBe('Auction not found');
  });

  it('places bid successfully and refreshes data', async () => {
    mockPlaceBid.mockResolvedValueOnce({ success: true, data: mockBid });

    const { result } = renderHook(() => useAuctionDetail('auction-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.placeBid({ bidPrice: 42, quantity: 100 });
    });

    expect(result.current.bidSuccess).toBe('Bid placed successfully!');
    expect(result.current.bidError).toBeNull();
    // auction + bids refetched after successful bid
    expect(mockGetAuctionById).toHaveBeenCalledTimes(2);
    expect(mockGetAuctionBids).toHaveBeenCalledTimes(2);
  });

  it('sets bidError when placeBid fails', async () => {
    mockPlaceBid.mockResolvedValueOnce({
      success: false,
      error: 'Auction has ended',
    });

    const { result } = renderHook(() => useAuctionDetail('auction-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.placeBid({ bidPrice: 30, quantity: 5 });
    });

    expect(result.current.bidError).toBe('Auction has ended');
    expect(result.current.bidSuccess).toBeNull();
  });

  it('clearBidFeedback resets bidError and bidSuccess', async () => {
    mockPlaceBid.mockResolvedValueOnce({ success: true, data: mockBid });

    const { result } = renderHook(() => useAuctionDetail('auction-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.placeBid({ bidPrice: 42, quantity: 10 });
    });

    expect(result.current.bidSuccess).toBe('Bid placed successfully!');

    act(() => {
      result.current.clearBidFeedback();
    });

    expect(result.current.bidSuccess).toBeNull();
    expect(result.current.bidError).toBeNull();
  });

  it('refresh triggers re-fetch of auction and bids', async () => {
    const { result } = renderHook(() => useAuctionDetail('auction-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAuctionById).toHaveBeenCalledTimes(2);
    expect(mockGetAuctionBids).toHaveBeenCalledTimes(2);
  });
});
