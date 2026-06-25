'use client';

import { useState, useCallback } from 'react';
import {
  Satellite,
  TrendingUp,
  CloudRain,
  Sun,
  Cloud,
  CloudSnow,
  Wind,
  RefreshCw,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { useSatelliteInsights } from '@/lib/hooks/useSatelliteInsights';
import SatelliteInsightsSkeleton from './SatelliteInsightsSkeleton';
import type { TimeRange, InsightMetric, WeatherForecast } from '@/lib/store/geospatial/geospatial.types';

interface SatelliteInsightsProps {
  projectId: string;
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const weatherIconMap = {
  sun: Sun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  wind: Wind,
};

const timeRangeOptions: { label: string; value: TimeRange }[] = [
  { label: 'Today', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'Year', value: 'year' },
];

const SatelliteInsights = ({
  projectId,
  className = '',
  autoRefresh = true,
  refreshInterval = 300000, // 5 minutes
}: SatelliteInsightsProps) => {
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);

  const {
    insights,
    weather,
    loading,
    error,
    timeRange,
    lastUpdated,
    isRefreshing,
    refresh,
    changeTimeRange,
    hasData,
    isEmpty,
    dataQuality,
  } = useSatelliteInsights({
    projectId,
    autoFetch: autoRefresh,
    timeRange: 'month',
    refreshInterval,
  });

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      changeTimeRange(range);
      setShowTimeRangeDropdown(false);
    },
    [changeTimeRange]
  );

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Loading state
  if (loading && !insights.length) {
    return <SatelliteInsightsSkeleton />;
  }

  // Error state
  if (error && !insights.length) {
    return (
      <div
        className={`bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl ${className}`}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-12 h-12 mb-4 text-white/60" />
          <h4 className="text-lg font-bold mb-2">Unable to load insights</h4>
          <p className="text-cyan-100 text-sm mb-4 max-w-md">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-2 bg-white text-cyan-700 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div
        className={`bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl ${className}`}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Satellite className="w-12 h-12 mb-4 text-white/60" />
          <h4 className="text-lg font-bold mb-2">No satellite data available</h4>
          <p className="text-cyan-100 text-sm mb-4">
            Satellite insights will appear here once data is collected for this project.
          </p>
          <button
            onClick={handleRefresh}
            className="px-6 py-2 bg-white text-cyan-700 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-white/20 rounded-lg mr-3">
            <Satellite className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Satellite Insights</h3>
            <p className="text-cyan-100 text-sm">
              {timeRangeOptions.find((t) => t.value === timeRange)?.label || 'Month'} trend
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
              className="px-3 py-1 bg-white/20 rounded-full text-sm flex items-center gap-1 hover:bg-white/30 transition-colors"
            >
              {timeRangeOptions.find((t) => t.value === timeRange)?.label || 'Month'}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showTimeRangeDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                {timeRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleTimeRangeChange(option.value)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      timeRange === option.value
                        ? 'text-cyan-600 font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1 bg-white/20 rounded-full text-sm hover:bg-white/30 transition-colors flex items-center gap-1 disabled:opacity-50"
            aria-label="Refresh satellite insights"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Last Updated */}
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs">
            Updated {formatLastUpdated(lastUpdated)}
          </span>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {insights.map((insight: InsightMetric) => (
          <div
            key={insight.metric}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl">{insight.icon}</div>
              <div
                className={`text-sm font-medium ${
                  insight.trend === 'up'
                    ? 'text-emerald-300'
                    : insight.trend === 'down'
                    ? 'text-amber-300'
                    : 'text-gray-300'
                }`}
              >
                {insight.change}
              </div>
            </div>
            <div className="text-2xl font-bold">{insight.value}</div>
            <div className="text-sm text-cyan-100">{insight.metric}</div>
          </div>
        ))}
      </div>

      {/* Weather Forecast */}
      {weather.length > 0 && (
        <div className="pt-6 border-t border-white/20">
          <h4 className="font-bold mb-4">Weather Forecast</h4>
          <div className="flex justify-between">
            {weather.map((day: WeatherForecast, index: number) => {
              const Icon =
                weatherIconMap[day.icon as keyof typeof weatherIconMap] ||
                Cloud;
              return (
                <div key={index} className="text-center">
                  <div className="text-sm text-cyan-100 mb-2">{day.day}</div>
                  <div className="p-2 bg-white/10 rounded-lg mb-2">
                    <Icon className="w-6 h-6 mx-auto" />
                  </div>
                  <div className="font-bold">{day.temp}°C</div>
                  <div className="text-sm text-cyan-100">{day.rain}% rain</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Quality Indicator */}
      {dataQuality && (
        <div className="mt-4 flex items-center gap-4 text-xs text-cyan-100 border-t border-white/10 pt-4">
          <span>Confidence: {(dataQuality.confidence * 100).toFixed(0)}%</span>
          <span>Sources: {dataQuality.sources.join(', ')}</span>
          <span>Cloud: {dataQuality.cloudCoverage}%</span>
        </div>
      )}

      <button className="w-full mt-4 py-3 bg-white text-cyan-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
        View Detailed Analytics
      </button>
    </div>
  );
};

export default SatelliteInsights;
