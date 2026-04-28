'use client';

import { useState, useCallback, useEffect } from 'react';
import { marketplaceService } from '@/services/marketplace.service';
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

  const fetchCredits = useCallback(
    async (currentFilters: LocalFilterState, currentPage: number) => {
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
        const response = await marketplaceService.searchCredits(query);
        if (response.success && response.data) {
          setCredits(response.data.data);
          setTotal(response.data.total);
        } else {
          setError(response.error || 'Failed to load marketplace credits');
          setCredits([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load credits',
        );
        setCredits([]);
      } finally {
        setLoading(false);
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

  useEffect(() => {
    fetchCredits(filters, page);
  }, [filters, page, fetchCredits]);

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
