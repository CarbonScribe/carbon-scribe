'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store/store';
import { HEALTH_CONSTANTS, UptimePeriod } from '@/lib/constants/health.constants';

interface UseUptimeStatsReturn {
  /** Overall uptime percentage for the selected period */
  overallUptime: number;
  /** SLA status: 'meeting' | 'violating' | 'unknown' */
  slaStatus: 'meeting' | 'violating' | 'unknown';
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Uptime stats data */
  uptimeStats: Array<{ period: string; value: number }> | null;
  /** Uptime for specific periods */
  uptime7d: number | null;
  uptime30d: number | null;
  uptime90d: number | null;
  /** Trend indicator */
  trend: 'up' | 'down' | 'stable' | null;
  /** Trend percentage change */
  trendChange: number | null;
  /** Refetch uptime data */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing uptime statistics
 */
export function useUptimeStats(period: UptimePeriod = '30d'): UseUptimeStatsReturn {
  const uptimeStats = useStore((state) => state.uptimeStats);
  const isLoading = useStore((state) => state.healthLoading.isFetchingUptime);
  const statusError = useStore((state) => state.healthErrors.uptime);
  const fetchUptimeStats = useStore((state) => state.fetchUptimeStats);
  const fetchDetailedStatus = useStore((state) => state.fetchDetailedStatus);

  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchUptimeStats(),
      fetchDetailedStatus(),
    ]);
  }, [fetchUptimeStats, fetchDetailedStatus]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, HEALTH_CONSTANTS.UPTIME_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Extract uptime values for different periods
  const uptime7d = useMemo(() => {
    const stat = uptimeStats?.find((s: { period: string; value: number }) => s.period === '7d');
    return stat?.value ?? null;
  }, [uptimeStats]);

  const uptime30d = useMemo(() => {
    const stat = uptimeStats?.find((s: { period: string; value: number }) => s.period === '30d');
    return stat?.value ?? null;
  }, [uptimeStats]);

  const uptime90d = useMemo(() => {
    const stat = uptimeStats?.find((s: { period: string; value: number }) => s.period === '90d');
    return stat?.value ?? null;
  }, [uptimeStats]);

  // Get overall uptime for selected period
  const overallUptime = useMemo(() => {
    const stat = uptimeStats?.find((s: { period: string; value: number }) => s.period === period);
    return stat?.value ?? uptime30d ?? 99.9;
  }, [uptimeStats, period, uptime30d]);

  // Calculate SLA status
  const slaStatus = useMemo((): 'meeting' | 'violating' | 'unknown' => {
    if (overallUptime === null || overallUptime === undefined) {
      return 'unknown';
    }
    return overallUptime >= HEALTH_CONSTANTS.DEFAULT_SLA_TARGET ? 'meeting' : 'violating';
  }, [overallUptime]);

  // Calculate trend (compare 30d vs 7d)
  const trend = useMemo(() => {
    if (uptime30d === null || uptime7d === null) {
      return null;
    }
    const diff = uptime7d - uptime30d;
    if (diff > 0.1) return 'up';
    if (diff < -0.1) return 'down';
    return 'stable';
  }, [uptime30d, uptime7d]);

  const trendChange = useMemo(() => {
    if (uptime30d === null || uptime7d === null) {
      return null;
    }
    return uptime7d - uptime30d;
  }, [uptime30d, uptime7d]);

  return {
    overallUptime,
    slaStatus,
    isLoading,
    error: statusError,
    uptimeStats,
    uptime7d,
    uptime30d,
    uptime90d,
    trend,
    trendChange,
    refetch: fetchData,
  };
}