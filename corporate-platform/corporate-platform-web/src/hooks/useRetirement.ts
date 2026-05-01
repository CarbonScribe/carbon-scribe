'use client';

import { useState, useCallback, useEffect } from 'react';
import { retirementService } from '@/services/retirement.service';
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
  retire: (payload: RetireCreditsPayload) => Promise<RetirementRecord | null>;
  fetchHistory: (query?: RetirementHistoryQuery) => Promise<void>;
  fetchStats: () => Promise<void>;
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
    async (query: RetirementHistoryQuery = initialQuery) => {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await retirementService.getHistory(query);
      if (res.success && res.data) {
        setHistory(res.data);
      } else {
        setHistoryError(res.error ?? 'Failed to fetch retirement history');
      }
      setHistoryLoading(false);
    },
    // intentionally omit initialQuery so callers can pass ad-hoc queries
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    const res = await retirementService.getStats();
    if (res.success && res.data) {
      setStats(res.data);
    } else {
      setStatsError(res.error ?? 'Failed to fetch retirement stats');
    }
    setStatsLoading(false);
  }, []);

  const retire = useCallback(
    async (payload: RetireCreditsPayload): Promise<RetirementRecord | null> => {
      setRetiring(true);
      setRetireError(null);
      const res = await retirementService.retire(payload);
      setRetiring(false);
      if (res.success && res.data) {
        setLastRetirement(res.data);
        return res.data;
      }
      setRetireError(res.error ?? 'Retirement failed. Please try again.');
      return null;
    },
    [],
  );

  const clearRetireError = useCallback(() => setRetireError(null), []);
  const clearLastRetirement = useCallback(() => setLastRetirement(null), []);

  useEffect(() => {
    if (autoFetch) {
      fetchHistory(initialQuery);
      fetchStats();
    }
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
