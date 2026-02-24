'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import { Database, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export default function DatasetExplorer() {
  const { datasets, datasetsLoading, datasetsError, fetchDatasets } = useReportsStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  if (datasetsLoading && datasets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (datasetsError) {
    return (
      <div className="py-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
        {datasetsError}
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
        <Database className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No datasets available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Dataset metadata</h3>
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {datasets.map((ds) => {
          const isOpen = expanded === ds.name;
          return (
            <div key={ds.name} className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : ds.name)}
                className="w-full flex items-center gap-2 p-4 text-left hover:bg-gray-50"
              >
                {isOpen ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                <Database className="w-5 h-5 text-emerald-600" />
                <span className="font-medium text-gray-900">{ds.display_name}</span>
                <span className="text-sm text-gray-500">({ds.name})</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-0">
                  {ds.description && (
                    <p className="text-sm text-gray-600 mb-3">{ds.description}</p>
                  )}
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Field</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Type</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Aggregatable</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Filterable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ds.fields.map((f) => (
                        <tr key={f.name} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium">{f.display_name}</td>
                          <td className="py-2 px-3 text-gray-600">{f.data_type}</td>
                          <td className="py-2 px-3">{f.is_aggregatable ? 'Yes' : 'No'}</td>
                          <td className="py-2 px-3">{f.is_filterable ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
