'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { marketplaceService } from '@/services/marketplace.service';
import { useDebounce } from '@/hooks/useDebounce';
import { isAbortError } from '@/lib/utils/request-dedup';
import {
  MarketplaceCredit,
  MarketplaceSearchQuery,
  MarketplaceStats,
  MarketplaceFiltersData,
  LocalFilterState,
} from '@/types/marketplace';

export const DEFAULT_FILTERS: LocalFilterState = {
  query: '',
  priceRange: [0, 200],
  methodologies: [],
  countries: [],
  sdgs: [],
  vintage: [2018, 2025],
  sortBy: '',
  sortOrder: 'asc',
};

export const PAGE_SIZE = 12;

/** How long (ms) to wait after the last filter change before issuing a fetch. */
const FILTER_DEBOUNCE_MS = 300;

export interface UseMarketplaceState {
  credits: MarketplaceCredit[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  filters: LocalFilterState;
  stats: MarketplaceStats | null;
  statsLoading: boolean;
  availableFilters: MarketplaceFiltersData | null;
  filtersLoading: boolean;
}

export interface UseMarketplaceActions {
  setFilters: (filters: LocalFilterState) => void;
  setPage: (page: number) => void;
  refresh: () => void;
}

export function useMarketplace(): UseMarketplaceState & UseMarketplaceActions {
  const [credits, setCredits] = useState<MarketplaceCredit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<LocalFilterState>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [availableFilters, setAvailableFilters] =
    useState<MarketplaceFiltersData | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);

  // Debounce the filter state so that rapid successive changes (e.g. quickly
  // toggling multiple checkboxes) only trigger a single API call once the
  // user pauses for FILTER_DEBOUNCE_MS.
  // NOTE: debouncedFilters is initialised synchronously to DEFAULT_FILTERS so
  // the first fetch on mount is never blocked.
  const debouncedFilters = useDebounce(filters, FILTER_DEBOUNCE_MS);

  // Monotonically-increasing counter used to detect and discard stale
  // responses that arrive after a newer request has superseded them.
  const requestIdRef = useRef(0);

  // AbortController for the latest in-flight credit search — allows the
  // browser to cancel the underlying HTTP request on the network level.
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCredits = useCallback(
    async (currentFilters: LocalFilterState, currentPage: number) => {
      // Cancel any in-flight request from a previous filter selection.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Tag this request so we can discard its response if a newer one starts.
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError(null);

      const query: MarketplaceSearchQuery = {
        page: currentPage,
        limit: PAGE_SIZE,
      };

      if (currentFilters.query) query.query = currentFilters.query;
      if (currentFilters.methodologies.length === 1)
        query.methodology = currentFilters.methodologies[0];
      if (currentFilters.countries.length === 1)
        query.country = currentFilters.countries[0];
      if (currentFilters.sdgs.length > 0) query.sdgs = currentFilters.sdgs;
      if (currentFilters.priceRange[0] > 0)
        query.priceMin = currentFilters.priceRange[0];
      if (currentFilters.priceRange[1] < 200)
        query.priceMax = currentFilters.priceRange[1];
      if (currentFilters.vintage[0] > 2018)
        query.vintageFrom = currentFilters.vintage[0];
      if (currentFilters.vintage[1] < 2025)
        query.vintageTo = currentFilters.vintage[1];
      if (currentFilters.sortBy) {
        query.sortBy = currentFilters.sortBy as MarketplaceSearchQuery['sortBy'];
        query.sortOrder = currentFilters.sortOrder;
      }

      try {
        const response = await marketplaceService.searchCredits(query, controller.signal);

        // Discard the response if a newer request has already taken over.
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;

        if (response.success && response.data) {
          setCredits(response.data.data);
          setTotal(response.data.total);
        } else {
          setError(response.error || 'Failed to load marketplace credits');
          setCredits([]);
        }
      } catch (err) {
        // AbortError is intentional — the request was superseded by a newer
        // filter selection. Do not surface this as a user-visible error.
        if (isAbortError(err) || controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load credits',
        );
        setCredits([]);
      } finally {
        // Only clear loading state if this is still the active request.
        if (requestId === requestIdRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await marketplaceService.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch {
      // stats are non-critical; silently fail
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAvailableFilters = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const response = await marketplaceService.getFilters();
      if (response.success && response.data) {
        setAvailableFilters(response.data);
      }
    } catch {
      // filter data is non-critical; silently fail
    } finally {
      setFiltersLoading(false);
    }
  }, []);

  // Trigger a credit fetch whenever the debounced filters or page changes.
  // Guard: if `filters` differs from `debouncedFilters` a filter change is
  // still debouncing — skip the fetch to avoid firing with a stale page reset
  // and then firing again 300 ms later when the debounce settles.
  useEffect(() => {
    if (filters !== debouncedFilters) return;
    fetchCredits(debouncedFilters, page);

    return () => {
      // Cancel the in-flight request when the effect re-runs (new deps) or
      // the component unmounts — prevents state updates on unmounted trees.
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters, page, fetchCredits, filters]);

  useEffect(() => {
    fetchStats();
    fetchAvailableFilters();
  }, [fetchStats, fetchAvailableFilters]);

  const setFilters = useCallback((newFilters: LocalFilterState) => {
    setFiltersState(newFilters);
    setPageState(1);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
  }, []);

  const refresh = useCallback(() => {
    fetchCredits(filters, page);
    fetchStats();
  }, [filters, page, fetchCredits, fetchStats]);

  return {
    credits,
    total,
    page,
    pageSize: PAGE_SIZE,
    loading,
    error,
    filters,
    stats,
    statsLoading,
    availableFilters,
    filtersLoading,
    setFilters,
    setPage,
    refresh,
  };
}
