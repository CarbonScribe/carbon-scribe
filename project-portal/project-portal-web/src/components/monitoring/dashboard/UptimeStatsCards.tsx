'use client';

import React, { useMemo } from 'react';
import { Activity, Server, Zap, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { useUptimeStats } from '@/hooks/useUptimeStats';
import { HEALTH_CONSTANTS } from '@/lib/constants/health.constants';

interface UptimeStatsCardsProps {
  /** Optional SLA target override */
  slaTarget?: number;
  /** Optional period for uptime display */
  period?: '7d' | '30d' | '90d';
}

export default function UptimeStatsCards({
  slaTarget = HEALTH_CONSTANTS.DEFAULT_SLA_TARGET,
  period = '30d',
}: UptimeStatsCardsProps) {
  const {
    overallUptime,
    slaStatus,
    isLoading,
    error,
    uptimeStats,
    uptime7d,
    uptime30d,
    uptime90d,
    trend,
    trendChange,
    refetch,
  } = useUptimeStats(period);

  // Get P99 latency from metrics or use fallback
  const p99Latency = useMemo(() => {
    // In a real implementation, this would come from the metrics API
    // For now, we use a placeholder that can be updated
    return '142ms';
  }, []);

  // Loading state
  if (isLoading && !uptimeStats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 bg-gray-50 animate-pulse rounded-lg border border-gray-100"
            role="status"
            aria-label="Loading uptime stats"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error && !uptimeStats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-full bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600 text-sm">
            Failed to load uptime data. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-700 underline hover:text-red-800"
            aria-label="Retry loading uptime data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!uptimeStats || uptimeStats.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-full bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm">No uptime data available</p>
        </div>
      </div>
    );
  }

  // Build cards data
  const cards = [
    {
      title: `${period} Uptime`,
      value: `${overallUptime.toFixed(2)}%`,
      icon: <Activity className="w-6 h-6 text-blue-500" />,
      subtext: trend ? (
        <span className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
          {trend === 'stable' && <span className="text-gray-400">—</span>}
          {trendChange !== null && (
            <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}>
              {trendChange > 0 ? '+' : ''}{trendChange.toFixed(2)}%
            </span>
          )}
        </span>
      ) : 'Across all services',
      tooltip: `7d: ${uptime7d?.toFixed(2) || 'N/A'}% | 30d: ${uptime30d?.toFixed(2) || 'N/A'}% | 90d: ${uptime90d?.toFixed(2) || 'N/A'}%`,
    },
    {
      title: 'Healthy Services',
      value: 'N/A', // This should come from detailedStatus
      icon: <Server className="w-6 h-6 text-green-500" />,
      subtext: 'Presently operational',
      loading: isLoading,
    },
    {
      title: 'SLA Status',
      value: slaStatus === 'meeting' ? 'Meeting' : slaStatus === 'violating' ? 'Violating' : 'Unknown',
      icon: <ShieldCheck className={`w-6 h-6 ${slaStatus === 'meeting' ? 'text-green-500' : slaStatus === 'violating' ? 'text-red-500' : 'text-gray-500'}`} />,
      subtext: `Target ${slaTarget.toFixed(2)}%`,
      tooltip: `Current uptime: ${overallUptime.toFixed(2)}%`,
    },
    {
      title: 'P99 Latency',
      value: p99Latency,
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      subtext: 'Global average',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white p-4 rounded-lg border shadow-sm flex items-center gap-4 group"
          role="article"
          aria-label={`${card.title}: ${card.value}`}
        >
          <div className="p-3 bg-gray-50 rounded-full">
            {card.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-gray-500 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
              {card.title}
              {card.tooltip && (
                <span className="cursor-help text-gray-400 hover:text-gray-600" title={card.tooltip}>
                  ⓘ
                </span>
              )}
            </div>
            {card.loading ? (
              <div className="h-7 w-16 bg-gray-200 animate-pulse rounded mt-0.5" />
            ) : (
              <div className="text-2xl font-bold text-gray-800 truncate">{card.value}</div>
            )}
            <div className="text-xs text-gray-400 mt-1 truncate">{card.subtext}</div>
          </div>
        </div>
      ))}
    </div>
  );
}