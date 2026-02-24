'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import type { DashboardWidget } from '@/store/reports.types';

interface GaugeWidgetProps {
  widget: DashboardWidget;
}

export default function GaugeWidget({ widget }: GaugeWidgetProps) {
  const { dashboardSummary, fetchDashboardSummary } = useReportsStore();
  const config = widget.config ?? {};
  const title = widget.title;
  const min = config.min_value ?? 0;
  const max = config.max_value ?? 100;
  const metricKey = config.metric_field ?? 'total_credits';

  useEffect(() => {
    fetchDashboardSummary();
  }, [fetchDashboardSummary]);

  const metrics = dashboardSummary?.performance_metrics ?? {};
  const meta = metrics[metricKey];
  const value = meta?.value ?? 0;
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  return (
    <div className="p-4 h-full min-h-[160px] flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="flex-1 flex flex-col justify-center">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>{min}</span>
          <span className="font-bold text-gray-900">{value}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
