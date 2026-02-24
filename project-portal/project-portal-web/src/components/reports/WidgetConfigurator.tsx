'use client';

import { useState } from 'react';
import type { DashboardWidget, WidgetConfig, WidgetType, WidgetSize } from '@/store/reports.types';

const SIZES: WidgetSize[] = ['small', 'medium', 'large', 'full'];
const REFRESH_OPTIONS = [60, 300, 600, 3600];

interface WidgetConfiguratorProps {
  widget: Partial<DashboardWidget> | null;
  onSave: (config: Partial<DashboardWidget> & { config: WidgetConfig }) => void;
  onCancel: () => void;
}

export default function WidgetConfigurator({ widget, onSave, onCancel }: WidgetConfiguratorProps) {
  const [title, setTitle] = useState(widget?.title ?? '');
  const [size, setSize] = useState<WidgetSize>(widget?.size ?? 'medium');
  const [refreshInterval, setRefreshInterval] = useState(
    widget?.config?.refresh_rate ?? widget?.refresh_interval_seconds ?? 300
  );
  const [dataSource, setDataSource] = useState(widget?.config?.data_source ?? 'dashboard_summary');
  const [metricField, setMetricField] = useState(widget?.config?.metric_field ?? 'total_credits');

  const handleSave = () => {
    onSave({
      title: title || 'Untitled Widget',
      size,
      refresh_interval_seconds: refreshInterval,
      config: {
        data_source: dataSource,
        refresh_rate: refreshInterval,
        metric_field: metricField,
      },
    });
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-gray-200">
      <h4 className="font-semibold text-gray-900">Widget settings</h4>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="Widget title"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
        <select
          value={size}
          onChange={(e) => setSize(e.target.value as WidgetSize)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Refresh (seconds)</label>
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          {REFRESH_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 60 ? '1 min' : s === 300 ? '5 min' : s === 600 ? '10 min' : '1 hour'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data source</label>
        <input
          type="text"
          value={dataSource}
          onChange={(e) => setDataSource(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Metric field</label>
        <select
          value={metricField}
          onChange={(e) => setMetricField(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="total_credits">Total credits</option>
          <option value="total_revenue">Total revenue</option>
          <option value="total_projects">Total projects</option>
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
