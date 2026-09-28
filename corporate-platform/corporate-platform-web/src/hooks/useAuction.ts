'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { auctionService } from '@/services/auction.service';
import { Auction, Bid, PlaceBidPayload } from '@/types/auction';

/** How often (ms) to poll for live auction status while an auction is active */
const POLL_INTERVAL_MS = 15_000;
/** Tighter poll cadence used inside the final FAST_POLL_WINDOW_MS before close */
const FAST_POLL_INTERVAL_MS = 4_000;
/** How close to auction end (ms) before switching to the faster poll cadence */
const FAST_POLL_WINDOW_MS = 60_000;
/** Consecutive poll failures after which the UI should flag data as possibly stale */
const STALE_AFTER_FAILURES = 3;
/** Base delay (ms) for exponential backoff after a poll failure */
const BACKOFF_BASE_MS = 2_000;
/** Ceiling for the exponential backoff delay (ms) */
const BACKOFF_MAX_MS = 60_000;

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
        setError(response.parsedError?.message || response.error || 'Failed to load auctions');
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
  /** Estimated `serverTime - Date.now()` offset (ms) from the last successful poll */
  clockSkewMs: number;
  /** `performance.now()` snapshot taken at the last successful poll, for computing freshness without depending on wall-clock deltas */
  lastUpdatedAtPerf: number | null;
  /** True once STALE_AFTER_FAILURES consecutive polls have failed */
  isStale: boolean;
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
  const [clockSkewMs, setClockSkewMs] = useState(0);
  const [lastUpdatedAtPerf, setLastUpdatedAtPerf] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailuresRef = useRef(0);
  // Mirrors `auction` and `clockSkewMs` for the poll scheduler to read without
  // forcing the scheduling effect to re-run (and restart its recursive
  // setTimeout chain) on every single poll.
  const auctionRef = useRef<Auction | null>(null);
  const clockSkewRef = useRef(0);

  const fetchAuction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await auctionService.getAuctionById(auctionId);
      if (response.success && response.data) {
        setAuction(response.data);
      } else {
        setError(response.parsedError?.message || response.error || 'Failed to load auction');
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

  // Keep refs in sync so the poll scheduler always sees fresh values without
  // needing them as effect dependencies (see note above).
  useEffect(() => {
    auctionRef.current = auction;
  }, [auction]);

  /**
   * Silent status poll — only updates auction state without showing loading.
   * Tracks server/client clock skew and consecutive-failure count so callers
   * can distinguish "no update happened" from "the pool is unreachable and
   * this data may be stale."
   */
  const pollStatus = useCallback(async () => {
    try {
      const response = await auctionService.getAuctionStatus(auctionId);
      if (response.success && response.data) {
        setAuction(response.data);
        consecutiveFailuresRef.current = 0;
        setIsStale(false);

        if (response.serverTime) {
          const serverMs = new Date(response.serverTime).getTime();
          if (!Number.isNaN(serverMs)) {
            const skew = serverMs - Date.now();
            clockSkewRef.current = skew;
            setClockSkewMs(skew);
          }
        }

        setLastUpdatedAtPerf(performance.now());
        return true;
      }
    } catch {
      // fall through to failure handling below
    }

    consecutiveFailuresRef.current += 1;
    if (consecutiveFailuresRef.current >= STALE_AFTER_FAILURES) {
      setIsStale(true);
    }
    return false;
  }, [auctionId]);

  const refresh = useCallback(() => {
    fetchAuction();
    fetchBids();
  }, [fetchAuction, fetchBids]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for live updates while auction is active. Uses a recursive
  // setTimeout (instead of setInterval) so the delay can adapt each cycle:
  // shorter near auction close, and backed off exponentially after failures.
  useEffect(() => {
    if (auction?.status !== 'active') {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const computeDelayMs = (): number => {
      if (consecutiveFailuresRef.current > 0) {
        const backoff =
          BACKOFF_BASE_MS * 2 ** (consecutiveFailuresRef.current - 1);
        return Math.min(backoff, BACKOFF_MAX_MS);
      }

      const endTime = auctionRef.current?.endTime;
      if (endTime) {
        const endMs = new Date(endTime).getTime();
        const estimatedNow = Date.now() + clockSkewRef.current;
        const remainingMs = endMs - estimatedNow;
        // Only tighten cadence while the auction is genuinely approaching
        // close. An auction whose end time has already passed (e.g. a stale
        // local 'active' status after the server has actually closed it)
        // must not be hammered at the fast interval indefinitely.
        if (!Number.isNaN(endMs) && remainingMs > 0 && remainingMs <= FAST_POLL_WINDOW_MS) {
          return FAST_POLL_INTERVAL_MS;
        }
      }

      return POLL_INTERVAL_MS;
    };

    const scheduleNext = () => {
      if (cancelled) return;
      pollTimeoutRef.current = setTimeout(async () => {
        await pollStatus();
        scheduleNext();
      }, computeDelayMs());
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [auction?.status, pollStatus]);

  // Browsers throttle setInterval/setTimeout in backgrounded tabs, so a
  // returning user can be looking at up to a minute of stale countdown data.
  // Force an immediate poll the moment the tab becomes visible again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        auctionRef.current?.status === 'active'
      ) {
        pollStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollStatus]);

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
          setBidError(response.parsedError?.message || response.error || 'Failed to place bid');
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
    clockSkewMs,
    lastUpdatedAtPerf,
    isStale,
    placeBid,
    refresh,
    clearBidFeedback,
  };
}
