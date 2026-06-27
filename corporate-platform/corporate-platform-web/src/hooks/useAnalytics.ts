import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDashboardOverview,
  getDashboardInsights,
  predictRetirements,
  predictImpact,
  getQualityRadar,
  getPortfolioQuality,
  getPerformanceOverTime,
  getPerformanceRankings,
} from '@/lib/api/analytics.api';
import type {
  DashboardOverview,
  DashboardInsights,
  RetirementForecast,
  ImpactForecast,
  QualityRadarData,
  PortfolioQualityScore,
  PerformanceTimeSeries,
  PerformanceRanking,
} from '@/types/analytics.types';
import { reportError } from '@/lib/telemetry/errorReporter';

interface UseAnalyticsState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useAnalytics<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
): UseAnalyticsState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monotonic counter used to detect and discard out-of-order responses.
  // When `fetchFn` or its deps change a new request starts; the previous
  // request's response is silently ignored if it resolves after the new one.
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      // Stale response — a newer fetch has already taken over.
      if (requestId !== requestIdRef.current) return;
      setData(result);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message || 'Failed to fetch analytics data');
      reportError(err, 'useAnalytics', 'error');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Dashboard Hooks
export function useDashboardOverview(period: string = 'MONTHLY') {
  return useAnalytics<DashboardOverview>(
    () => getDashboardOverview(period),
    [period]
  );
}

export function useDashboardInsights() {
  return useAnalytics<DashboardInsights>(() => getDashboardInsights());
}

// Predictive Analytics Hooks
export function useRetirementForecast(months: number = 12) {
  return useAnalytics<RetirementForecast>(
    () => predictRetirements(months),
    [months]
  );
}

export function useImpactForecast(months: number = 12) {
  return useAnalytics<ImpactForecast>(
    () => predictImpact(months),
    [months]
  );
}

// Quality Analytics Hooks
export function useQualityRadar(projectId: string) {
  return useAnalytics<QualityRadarData>(
    () => getQualityRadar(projectId),
    [projectId]
  );
}

export function usePortfolioQuality() {
  return useAnalytics<PortfolioQualityScore>(() => getPortfolioQuality());
}

// Performance Analytics Hooks
export function usePerformanceOverTime(startDate: string, endDate: string) {
  return useAnalytics<PerformanceTimeSeries>(
    () => getPerformanceOverTime(startDate, endDate),
    [startDate, endDate]
  );
}

export function usePerformanceRankings(metric: string = 'quality', period: string = 'MONTHLY') {
  return useAnalytics<PerformanceRanking>(
    () => getPerformanceRankings(metric, period),
    [metric, period]
  );
}
