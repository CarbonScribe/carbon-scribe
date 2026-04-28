import { useState, useEffect, useCallback } from 'react';
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
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
