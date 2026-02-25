'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import type { DashboardWidget } from '@/store/reports.types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricWidgetProps {
  widget: DashboardWidget;
}

export default function MetricWidget({ widget }: MetricWidgetProps) {
  const { dashboardSummary, fetchDashboardSummary } = useReportsStore();
  const config = widget.config ?? {};
  const title = widget.title;
  const metricKey = config.metric_field ?? 'total_credits';
  const prefix = config.prefix ?? '';
  const suffix = config.suffix ?? '';

  useEffect(() => {
    fetchDashboardSummary();
  }, [fetchDashboardSummary]);

  const metrics = dashboardSummary?.performance_metrics ?? {};
  const meta = metrics[metricKey];
  const fallback = dashboardSummary
    ? (metricKey === 'total_projects' && dashboardSummary.total_projects) ||
      (metricKey === 'total_credits' && dashboardSummary.total_credits) ||
      (metricKey === 'total_revenue' && dashboardSummary.total_revenue) ||
      null
    : null;
  const value = meta?.value ?? fallback ?? 0;
  const change = meta?.change_percent ?? 0;
  const trend = meta?.trend ?? (change >= 0 ? 'up' : 'down');

  return (
    <div className="p-4 h-full min-h-[120px] flex flex-col justify-center">
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {prefix}
          {typeof value === 'number' && (value >= 1000 || value <= -1000)
            ? value.toLocaleString()
            : value}
          {suffix}
        </span>
        {change !== 0 && (
          <span
            className={`inline-flex items-center text-sm font-medium ${
              trend === 'up' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-0.5" /> : <TrendingDown className="w-4 h-4 mr-0.5" />}
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
