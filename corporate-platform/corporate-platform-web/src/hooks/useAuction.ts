'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { auctionService } from '@/services/auction.service';
import { Auction, Bid, PlaceBidPayload } from '@/types/auction';

/** How often (ms) to poll for live auction status while an auction is active */
const POLL_INTERVAL_MS = 15_000;

// ── Auction List ──────────────────────────────────────────────────────────────

export interface UseAuctionListState {
  auctions: Auction[];
  loading: boolean;
  error: string | null;
}

export interface UseAuctionListActions {
  refresh: () => void;
}

/**
 * Fetches all auctions and refreshes them on demand.
 */
export function useAuctionList(): UseAuctionListState & UseAuctionListActions {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await auctionService.getAuctions();
      if (response.success && response.data) {
        setAuctions(response.data);
      } else {
        setError(response.error || 'Failed to load auctions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auctions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  return { auctions, loading, error, refresh: fetchAuctions };
}

// ── Auction Detail ────────────────────────────────────────────────────────────

export interface UseAuctionDetailState {
  auction: Auction | null;
  bids: Bid[];
  loading: boolean;
  bidsLoading: boolean;
  error: string | null;
  bidError: string | null;
  bidSuccess: string | null;
  placingBid: boolean;
}

export interface UseAuctionDetailActions {
  placeBid: (payload: PlaceBidPayload) => Promise<void>;
  refresh: () => void;
  clearBidFeedback: () => void;
}

/**
 * Manages full auction detail state: auction data, bid history, bid placement,
 * and live polling while the auction is active.
 */
export function useAuctionDetail(
  auctionId: string,
): UseAuctionDetailState & UseAuctionDetailActions {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);
  const [placingBid, setPlacingBid] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAuction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await auctionService.getAuctionById(auctionId);
      if (response.success && response.data) {
        setAuction(response.data);
      } else {
        setError(response.error || 'Failed to load auction');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auction');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  const fetchBids = useCallback(async () => {
    setBidsLoading(true);
    try {
      const response = await auctionService.getAuctionBids(auctionId);
      if (response.success && response.data) {
        setBids(response.data);
      }
    } catch {
      // bid history is non-critical; silently ignore
    } finally {
      setBidsLoading(false);
    }
  }, [auctionId]);

  /** Silent status poll — only updates auction state without showing loading */
  const pollStatus = useCallback(async () => {
    try {
      const response = await auctionService.getAuctionStatus(auctionId);
      if (response.success && response.data) {
        setAuction(response.data);
      }
    } catch {
      // polling errors are non-critical
    }
  }, [auctionId]);

  const refresh = useCallback(() => {
    fetchAuction();
    fetchBids();
  }, [fetchAuction, fetchBids]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for live updates while auction is active
  useEffect(() => {
    if (auction?.status === 'active') {
      pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [auction?.status, pollStatus]);

  const placeBid = useCallback(
    async (payload: PlaceBidPayload) => {
      setPlacingBid(true);
      setBidError(null);
      setBidSuccess(null);
      try {
        const response = await auctionService.placeBid(auctionId, payload);
        if (response.success) {
          setBidSuccess('Bid placed successfully!');
          await Promise.all([fetchAuction(), fetchBids()]);
        } else {
          setBidError(response.error || 'Failed to place bid');
        }
      } catch (err) {
        setBidError(
          err instanceof Error ? err.message : 'Failed to place bid',
        );
      } finally {
        setPlacingBid(false);
      }
    },
    [auctionId, fetchAuction, fetchBids],
  );

  const clearBidFeedback = useCallback(() => {
    setBidError(null);
    setBidSuccess(null);
  }, []);

  return {
    auction,
    bids,
    loading,
    bidsLoading,
    error,
    bidError,
    bidSuccess,
    placingBid,
    placeBid,
    refresh,
    clearBidFeedback,
  };
}
