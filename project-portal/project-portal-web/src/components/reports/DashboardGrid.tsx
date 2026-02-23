'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import type { DashboardWidget as Widget } from '@/store/reports.types';
import ChartWidget from './widgets/ChartWidget';
import MetricWidget from './widgets/MetricWidget';
import TableWidget from './widgets/TableWidget';
import GaugeWidget from './widgets/GaugeWidget';
import { Loader2 } from 'lucide-react';

interface DashboardGridProps {
  section?: string;
}

function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.widget_type) {
    case 'chart':
      return <ChartWidget widget={widget} />;
    case 'metric':
      return <MetricWidget widget={widget} />;
    case 'table':
      return <TableWidget widget={widget} />;
    case 'gauge':
      return <GaugeWidget widget={widget} />;
    default:
      return (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-sm">
          Unknown widget type: {widget.widget_type}
        </div>
      );
  }
}

export default function DashboardGrid({ section }: DashboardGridProps) {
  const { widgets, widgetsLoading, widgetsError, fetchWidgets } = useReportsStore();

  useEffect(() => {
    fetchWidgets(section);
  }, [fetchWidgets, section]);

  if (widgetsLoading && widgets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (widgetsError) {
    return (
      <div className="py-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
        {widgetsError}
      </div>
    );
  }

  const sorted = [...widgets].sort((a, b) => a.position - b.position);

  return (
    <div
      className="grid gap-4 w-full"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}
    >
      {sorted.map((widget) => (
        <div
          key={widget.id}
          className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${
            widget.size === 'large' || widget.size === 'full' ? 'md:col-span-2' : ''
          } ${widget.size === 'full' ? 'md:col-span-3' : ''}`}
        >
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  );
}
