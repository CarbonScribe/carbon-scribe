'use client';

import { BarChart3, Hash, Table, Gauge } from 'lucide-react';
import type { WidgetType } from '@/store/reports.types';

const WIDGET_TYPES: { type: WidgetType; label: string; icon: typeof BarChart3 }[] = [
  { type: 'chart', label: 'Chart', icon: BarChart3 },
  { type: 'metric', label: 'Metric', icon: Hash },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'gauge', label: 'Gauge', icon: Gauge },
];

interface WidgetLibraryProps {
  onSelect: (type: WidgetType) => void;
  disabled?: boolean;
}

export default function WidgetLibrary({ onSelect, disabled }: WidgetLibraryProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {WIDGET_TYPES.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          disabled={disabled}
          className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 text-left transition-colors disabled:opacity-50"
        >
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <Icon className="w-5 h-5" />
          </div>
          <span className="font-medium text-gray-900">{label}</span>
        </button>
      ))}
    </div>
  );
}
