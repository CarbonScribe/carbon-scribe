'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  TreePine,
  Coins,
  Users,
  Droplets,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useReportsStore } from '@/store/store';
import { toast } from 'sonner';
import * as api from '@/store/reports.api';

export default function AnalyticsPage() {
  const {
    dashboardSummary,
    dashboardSummaryLoading,
    dashboardSummaryError,
    fetchDashboardSummary,
  } = useReportsStore();

  const [timeRange, setTimeRange] = useState('year');
  const [selectedMetric, setSelectedMetric] = useState('carbon_sequestered');
  const [timeSeriesData, setTimeSeriesData] = useState<Array<{ time: string; value: number; label?: string }>>([]);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);

  useEffect(() => {
    fetchDashboardSummary(true);
  }, [fetchDashboardSummary]);

  useEffect(() => {
    const now = new Date();
    const end = now.toISOString();
    const start = new Date(
      timeRange === 'week' ? now.getTime() - 7 * 86400000 :
      timeRange === 'month' ? now.getTime() - 30 * 86400000 :
      timeRange === 'quarter' ? now.getTime() - 90 * 86400000 :
      now.getTime() - 365 * 86400000
    ).toISOString();

    const interval =
      timeRange === 'week' ? 'day' :
      timeRange === 'month' ? 'day' :
      timeRange === 'quarter' ? 'week' : 'month';

    setTimeSeriesLoading(true);
    api.apiGetTimeSeriesData({ metric: selectedMetric, start_time: start, end_time: end, interval })
      .then((res) => setTimeSeriesData(res.data ?? []))
      .catch(() => setTimeSeriesData([]))
      .finally(() => setTimeSeriesLoading(false));
  }, [timeRange, selectedMetric]);

  const handleRefresh = () => {
    fetchDashboardSummary(true);
    toast.success('Data refreshed');
  };

  const handleExport = async () => {
    toast.info('Export started — check Execution History in Reports');
  };

  const summary = dashboardSummary;
  const loading = dashboardSummaryLoading;
  const error = dashboardSummaryError;

  const kpiCards = [
    {
      title: 'Total Carbon Credits',
      value: summary ? `${summary.total_credits.toLocaleString()} tCO₂` : '—',
      change: summary?.performance_metrics?.['carbon_credits']?.change_percent,
      icon: TreePine,
      color: 'from-emerald-500 to-green-500',
    },
    {
      title: 'Total Revenue',
      value: summary ? `$${summary.total_revenue.toLocaleString()}` : '—',
      change: summary?.performance_metrics?.['revenue']?.change_percent,
      icon: Coins,
      color: 'from-amber-500 to-orange-500',
    },
    {
      title: 'Active Projects',
      value: summary ? String(summary.total_projects) : '—',
      change: summary?.performance_metrics?.['projects']?.change_percent,
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Monitoring Areas',
      value: summary ? String(summary.active_monitoring_areas) : '—',
      change: summary?.performance_metrics?.['monitoring']?.change_percent,
      icon: Droplets,
      color: 'from-cyan-500 to-teal-500',
    },
  ];

  const maxValue = timeSeriesData.length > 0 ? Math.max(...timeSeriesData.map((d) => d.value)) : 1;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-cyan-500 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="p-3 bg-white/20 rounded-xl">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
              <p className="text-cyan-100 mt-1">Live insights from your carbon projects</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-white/20 rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-white text-cyan-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="quarter">Last quarter</option>
              <option value="year">Last year</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="carbon_sequestered">Carbon Sequestered</option>
              <option value="revenue">Revenue</option>
              <option value="projects">Projects</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" aria-busy={loading} aria-label="KPI metrics">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse" aria-hidden="true">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                  <div className="w-16 h-5 bg-gray-200 rounded" />
                </div>
                <div className="h-8 w-28 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-36 bg-gray-100 rounded" />
              </div>
            ))
          : kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              const pct = kpi.change;
              return (
                <div key={kpi.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-linear-to-r ${kpi.color}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {pct !== undefined && (
                      <div className={`flex items-center ${pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pct >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        <span className="font-medium">{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</div>
                  <div className="text-sm text-gray-600">{kpi.title}</div>
                </div>
              );
            })}
      </div>

      {/* Time Series Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" aria-busy={timeSeriesLoading}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Performance Over Time</h3>
          {timeSeriesLoading && <Loader2 className="w-5 h-5 animate-spin text-emerald-600" aria-label="Loading chart data" />}
        </div>

        {timeSeriesLoading ? (
          <div className="h-48 flex items-end gap-1 animate-pulse" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-200 rounded-t-sm"
                style={{ height: `${30 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        ) : timeSeriesData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-500 bg-gray-50 rounded-xl">
            No time series data available for this metric and period.
          </div>
        ) : (
          <div className="h-48 flex items-end gap-1">
            {timeSeriesData.map((point, i) => {
              const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
              const label = new Date(point.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              return (
                <div key={i} className="flex flex-col items-center flex-1 min-w-0" title={`${label}: ${point.value}`}>
                  <div
                    className="w-full rounded-t-sm bg-emerald-500 transition-all duration-500"
                    style={{ height: `${height}%` }}
                  />
                  {timeSeriesData.length <= 14 && (
                    <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">{label}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {summary?.recent_activity && summary.recent_activity.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {summary.recent_activity.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-2 h-2 mt-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(item.timestamp).toLocaleString()} · {item.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {summary?.performance_metrics && Object.keys(summary.performance_metrics).length > 0 && (
        <div className="bg-linear-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <h3 className="text-xl font-bold mb-6">Performance Metrics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(summary.performance_metrics).map(([key, metric]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-lg">{metric.value.toLocaleString()}</span>
                    {metric.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-200" />
                    ) : metric.trend === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-amber-200" />
                    ) : null}
                  </div>
                </div>
                <div className="text-sm text-emerald-200">
                  {metric.change_percent >= 0 ? '+' : ''}{metric.change_percent.toFixed(1)}% · {metric.period}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
