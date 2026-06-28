'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { retirementService } from '@/services/retirement.service';
import type { ApiFetchOptions } from '@/services/api-client';
import type {
  RetireCreditsPayload,
  RetirementRecord,
  RetirementStats,
  RetirementHistoryQuery,
  RetirementHistoryResponse,
} from '@/types/retirement';

export interface UseRetirementState {
  history: RetirementHistoryResponse | null;
  stats: RetirementStats | null;
  historyLoading: boolean;
  statsLoading: boolean;
  historyError: string | null;
  statsError: string | null;
  retiring: boolean;
  retireError: string | null;
  lastRetirement: RetirementRecord | null;
}

export interface UseRetirementActions {
  retire: (payload: RetireCreditsPayload, options?: ApiFetchOptions) => Promise<RetirementRecord | null>;
  fetchHistory: (query?: RetirementHistoryQuery, options?: ApiFetchOptions) => Promise<void>;
  fetchStats: (options?: ApiFetchOptions) => Promise<void>;
  clearRetireError: () => void;
  clearLastRetirement: () => void;
}

/**
 * Hook for managing retirement state and actions.
 *
 * @param autoFetch - When true, fetches history and stats on mount.
 * @param initialQuery - Initial query parameters for the history fetch.
 */
export function useRetirement(
  autoFetch = false,
  initialQuery: RetirementHistoryQuery = {},
): UseRetirementState & UseRetirementActions {
  const [history, setHistory] = useState<RetirementHistoryResponse | null>(
    null,
  );
  const [stats, setStats] = useState<RetirementStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [retiring, setRetiring] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);
  const [lastRetirement, setLastRetirement] =
    useState<RetirementRecord | null>(null);

  const fetchHistory = useCallback(
    async (query: RetirementHistoryQuery = initialQuery, options?: ApiFetchOptions) => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await retirementService.getHistory(query, options);
        if (res.isCancelled) return; // Skip state update if cancelled
        if (res.success && res.data) {
          setHistory(res.data);
        } else {
          const errorMsg = (res.parsedError?.message || res.error) ?? 'Failed to fetch retirement history';
          setHistoryError(errorMsg);
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    // intentionally omit initialQuery so callers can pass ad-hoc queries
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const fetchStats = useCallback(async (options?: ApiFetchOptions) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await retirementService.getStats(options);
      if (res.isCancelled) return; // Skip state update if cancelled
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setStatsError(res.parsedError?.message ?? res.error ?? 'Failed to fetch retirement stats');
      }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const retire = useCallback(
    async (payload: RetireCreditsPayload, options?: ApiFetchOptions): Promise<RetirementRecord | null> => {
      setRetiring(true);
      setRetireError(null);
      const res = await retirementService.retire(payload, options);
      if (res.isCancelled) {
        setRetiring(false);
        return null;
      }
      setRetiring(false);
      if (res.success && res.data) {
        setLastRetirement(res.data);
        return res.data;
      }
      setRetireError(res.parsedError?.message ?? res.error ?? 'Retirement failed. Please try again.');
      return null;
    },
    [],
  );

  const clearRetireError = useCallback(() => setRetireError(null), []);
  const clearLastRetirement = useCallback(() => setLastRetirement(null), []);

  useEffect(() => {
    const abortController = new AbortController();
    
    if (autoFetch) {
      fetchHistory(initialQuery, { signal: abortController.signal });
      fetchStats({ signal: abortController.signal });
    }
    
    return () => {
      abortController.abort('useRetirement unmounted');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  return {
    history,
    stats,
    historyLoading,
    statsLoading,
    historyError,
    statsError,
    retiring,
    retireError,
    lastRetirement,
    retire,
    fetchHistory,
    fetchStats,
    clearRetireError,
    clearLastRetirement,
  };
}
