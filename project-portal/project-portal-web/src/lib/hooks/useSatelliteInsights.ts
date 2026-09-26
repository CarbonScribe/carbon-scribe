'use client';

import { useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store/store';
import type { TimeRange, InsightMetric, WeatherForecast } from '@/lib/store/geospatial/geospatial.types';

interface UseSatelliteInsightsOptions {
  projectId: string;
  autoFetch?: boolean;
  timeRange?: TimeRange;
  refreshInterval?: number; // in milliseconds
}

export function useSatelliteInsights({
  projectId,
  autoFetch = true,
  timeRange = 'month',
  refreshInterval,
}: UseSatelliteInsightsOptions) {
  const {
    insightsData,
    weatherData,
    insightsLoading,
    insightsError,
    selectedTimeRange,
    isRefreshing,
    lastRefreshed,
    fetchSatelliteInsights,
    fetchWeatherForecast,
    refreshSatelliteInsights,
    setInsightsTimeRange,
    clearInsightsData,
  } = useStore((state) => ({
    insightsData: state.insightsData,
    weatherData: state.weatherData,
    insightsLoading: state.insightsLoading,
    insightsError: state.insightsError,
    selectedTimeRange: state.selectedTimeRange,
    isRefreshing: state.isRefreshing,
    lastRefreshed: state.lastRefreshed,
    fetchSatelliteInsights: state.fetchSatelliteInsights,
    fetchWeatherForecast: state.fetchWeatherForecast,
    refreshSatelliteInsights: state.refreshSatelliteInsights,
    setInsightsTimeRange: state.setInsightsTimeRange,
    clearInsightsData: state.clearInsightsData,
  }));

  // Initial fetch
  useEffect(() => {
    if (autoFetch && projectId) {
      fetchSatelliteInsights(projectId, timeRange);
      fetchWeatherForecast(projectId);
    }

    return () => {
      clearInsightsData();
    };
  }, [projectId, autoFetch]);

  // Set time range
  useEffect(() => {
    if (timeRange && timeRange !== selectedTimeRange) {
      setInsightsTimeRange(timeRange);
    }
  }, [timeRange, selectedTimeRange]);

  // Refresh interval
  useEffect(() => {
    if (!refreshInterval || !projectId) return;

    const interval = setInterval(() => {
      refreshSatelliteInsights(projectId);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, projectId]);

  const refresh = useCallback(() => {
    if (projectId) {
      return refreshSatelliteInsights(projectId);
    }
  }, [projectId, refreshSatelliteInsights]);

  const changeTimeRange = useCallback(
    (newRange: TimeRange) => {
      setInsightsTimeRange(newRange);
      if (projectId) {
        fetchSatelliteInsights(projectId, newRange);
      }
    },
    [projectId, fetchSatelliteInsights, setInsightsTimeRange]
  );

  return {
    insights: insightsData?.insights || [],
    weather: weatherData.length > 0 ? weatherData : insightsData?.weather || [],
    loading: insightsLoading,
    error: insightsError,
    timeRange: selectedTimeRange,
    lastUpdated: insightsData?.lastUpdated || lastRefreshed,
    isRefreshing,
    dataQuality: insightsData?.dataQuality,
    refresh,
    changeTimeRange,
    hasData: (insightsData?.insights?.length || 0) > 0,
    isEmpty: !insightsLoading && !insightsError && !insightsData,
  };
}
