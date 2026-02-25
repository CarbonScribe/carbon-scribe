'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import type { DashboardWidget } from '@/store/reports.types';
import { BarChart3 } from 'lucide-react';

interface ChartWidgetProps {
  widget: DashboardWidget;
}

export default function ChartWidget({ widget }: ChartWidgetProps) {
  const { dashboardSummary, fetchDashboardSummary } = useReportsStore();
  const config = widget.config ?? {};
  const title = widget.title;

  useEffect(() => {
    fetchDashboardSummary();
  }, [fetchDashboardSummary]);

  const series = dashboardSummary?.time_series_data
    ? Object.entries(dashboardSummary.time_series_data)[0]
    : null;
  const data = series?.[1] ?? [];

  return (
    <div className="p-4 h-full min-h-[200px] flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {data.length > 0 ? (
        <div className="flex-1 flex items-end gap-1 pt-4">
          {data.slice(0, 12).map((point, i) => {
            const max = Math.max(...data.map((p) => p.value), 1);
            const h = (point.value / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-emerald-500 rounded-t min-h-[4px] transition-all"
                style={{ height: `${Math.max(h, 4)}%` }}
                title={`${point.label ?? point.time}: ${point.value}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <BarChart3 className="w-12 h-12" />
          <span className="ml-2 text-sm">No time series data</span>
        </div>
      )}
    </div>
  );
}
