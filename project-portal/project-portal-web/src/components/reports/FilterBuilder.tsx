'use client';

import type { FilterConfig } from '@/store/reports.types';
import { Plus, Trash2 } from 'lucide-react';

const OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'like', label: 'Contains' },
  { value: 'in', label: 'In list' },
  { value: 'between', label: 'Between' },
];

interface FilterBuilderProps {
  filters: FilterConfig[];
  fieldOptions: { name: string; display_name: string }[];
  onChange: (filters: FilterConfig[]) => void;
  disabled?: boolean;
}

export default function FilterBuilder({
  filters,
  fieldOptions,
  onChange,
  disabled,
}: FilterBuilderProps) {
  const addFilter = () => {
    const first = fieldOptions[0];
    onChange([
      ...filters,
      { field: first?.name ?? '', operator: 'eq', value: '', logic: filters.length ? 'AND' : undefined },
    ]);
  };

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    const next = [...filters];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const removeFilter = (index: number) => {
    const next = filters.filter((_, i) => i !== index);
    next.forEach((f, i) => {
      f.logic = i === 0 ? undefined : 'AND';
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Filters (AND/OR)</h4>
        <button
          type="button"
          onClick={addFilter}
          disabled={disabled || fieldOptions.length === 0}
          className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add condition
        </button>
      </div>

      {filters.length === 0 && (
        <p className="text-sm text-gray-500">No filters. Add a condition to narrow results.</p>
      )}

      <div className="space-y-2">
        {filters.map((filter, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            {idx > 0 && (
              <select
                value={filter.logic ?? 'AND'}
                onChange={(e) => updateFilter(idx, { logic: e.target.value as 'AND' | 'OR' })}
                className="text-sm font-medium text-gray-700 border border-gray-300 rounded px-2 py-1 w-16"
                disabled={disabled}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <select
              value={filter.field}
              onChange={(e) => updateFilter(idx, { field: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1 min-w-[120px]"
              disabled={disabled}
            >
              <option value="">Select field</option>
              {fieldOptions.map((f) => (
                <option key={f.name} value={f.name}>{f.display_name}</option>
              ))}
            </select>
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(idx, { operator: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1"
              disabled={disabled}
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={typeof filter.value === 'string' ? filter.value : ''}
              onChange={(e) => updateFilter(idx, { value: e.target.value })}
              placeholder="Value"
              className="text-sm border border-gray-300 rounded px-2 py-1 min-w-[100px]"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => removeFilter(idx)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              disabled={disabled}
              aria-label="Remove filter"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
