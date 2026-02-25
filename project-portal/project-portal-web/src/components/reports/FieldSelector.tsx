'use client';

import type { FieldConfig, FieldMetadata } from '@/store/reports.types';
import { Plus, X } from 'lucide-react';

type AggregateFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

interface FieldSelectorProps {
  availableFields: FieldMetadata[];
  selectedFields: FieldConfig[];
  onAdd: (field: FieldConfig) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<FieldConfig>) => void;
  disabled?: boolean;
}

const AGG_OPTIONS: { value: AggregateFunction; label: string }[] = [
  { value: 'SUM', label: 'Sum' },
  { value: 'AVG', label: 'Avg' },
  { value: 'COUNT', label: 'Count' },
  { value: 'MIN', label: 'Min' },
  { value: 'MAX', label: 'Max' },
];

export default function FieldSelector({
  availableFields,
  selectedFields,
  onAdd,
  onRemove,
  onUpdate,
  disabled,
}: FieldSelectorProps) {
  const addField = (f: FieldMetadata) => {
    onAdd({
      name: f.name,
      alias: f.display_name,
      data_type: f.data_type,
      sort_order: selectedFields.length,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Fields</h4>
        {availableFields.length === 0 && (
          <span className="text-sm text-gray-500">Load a dataset to see fields</span>
        )}
      </div>

      <div className="space-y-2">
        {selectedFields.map((field, idx) => (
          <div
            key={`${field.name}-${idx}`}
            className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
          >
            <span className="flex-1 font-medium text-gray-800 truncate">{field.alias || field.name}</span>
            {availableFields.find((f) => f.name === field.name)?.is_aggregatable && (
              <select
                value={field.aggregate ?? ''}
                onChange={(e) => onUpdate(idx, { aggregate: (e.target.value || undefined) as AggregateFunction })}
                className="text-sm border border-gray-300 rounded px-2 py-1"
                disabled={disabled}
              >
                <option value="">—</option>
                {AGG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              disabled={disabled}
              aria-label="Remove field"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {availableFields.length > 0 && (
        <div className="border border-dashed border-gray-300 rounded-lg p-3">
          <p className="text-sm text-gray-600 mb-2">Add field</p>
          <div className="flex flex-wrap gap-2">
            {availableFields
              .filter((f) => !selectedFields.some((s) => s.name === f.name))
              .map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => addField(f)}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-200"
                  disabled={disabled}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {f.display_name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
