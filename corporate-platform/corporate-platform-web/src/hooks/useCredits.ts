import { useState, useEffect, useCallback } from 'react';
import {
  listCredits,
  getAvailableCredits,
  getCreditFilters,
  getCreditStats,
  compareCredits,
  getCreditDetail,
  getCreditQuality,
} from '@/lib/api/credit.api';
import type {
  CreditListResponse,
  CreditDetail,
  CreditQualityBreakdown,
  ComparisonResult,
  CreditFilters,
  CreditQueryParams,
  CreditStats,
} from '@/types/credit.types';

interface UseCreditState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useCredit<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
): UseCreditState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch credit data');
      console.error('Credit fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Credit Listing Hooks

export function useCredits(params: CreditQueryParams = {}) {
  return useCredit<CreditListResponse>(
    () => listCredits(params),
    [JSON.stringify(params)]
  );
}

export function useAvailableCredits(page: number = 1, limit: number = 20) {
  return useCredit(() => getAvailableCredits(page, limit), [page, limit]);
}

// Credit Detail Hooks

export function useCreditDetail(creditId: string) {
  return useCredit<CreditDetail>(
    () => getCreditDetail(creditId),
    [creditId]
  );
}

export function useCreditQuality(creditId: string) {
  return useCredit<CreditQualityBreakdown>(
    () => getCreditQuality(creditId),
    [creditId]
  );
}

// Credit Filters & Stats Hooks

export function useCreditFilters() {
  return useCredit<CreditFilters>(() => getCreditFilters());
}

export function useCreditStats() {
  return useCredit<CreditStats>(() => getCreditStats());
}

// Credit Comparison Hook

export function useCreditComparison(projectIds: string[]) {
  return useCredit<ComparisonResult>(
    () => compareCredits(projectIds),
    [JSON.stringify(projectIds)]
  );
}
