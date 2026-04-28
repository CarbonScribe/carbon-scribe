'use client';

import React, { useState, useEffect } from 'react';
import { queryAuditEvents, exportAuditEvents } from '@/lib/api/audit.api';
import type { AuditEvent, AuditQueryParams, AuditEventType, AuditAction } from '@/types/audit.types';
import { formatDate, formatEventType, formatAction } from '@/lib/utils/audit-formatters';

interface AuditTrailViewerProps {
  entityType?: string;
  entityId?: string;
  compact?: boolean;
}

export default function AuditTrailViewer({ entityType, entityId, compact }: AuditTrailViewerProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditQueryParams>({
    eventType: undefined,
    action: undefined,
    entityType,
    entityId,
    from: undefined,
    to: undefined,
    limit: compact ? 10 : 20,
  });

  useEffect(() => {
    loadEvents();
  }, [filters, page]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await queryAuditEvents({ ...filters, page });
      setEvents(response.events);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportAuditEvents({ ...filters, format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-events-${Date.now()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const totalPages = Math.ceil(total / (filters.limit || 20));

  if (loading) {
    return <div className="p-8 text-center">Loading audit trail...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {!compact && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Event Type</label>
              <select
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                value={filters.eventType || ''}
                onChange={(e) => setFilters({ ...filters, eventType: e.target.value || undefined })}
              >
                <option value="">All Types</option>
                <option value="RETIREMENT">Retirement</option>
                <option value="COMPLIANCE_REPORT">Compliance Report</option>
                <option value="GHG_CALCULATION">GHG Calculation</option>
                <option value="USER_ACTION">User Action</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <select
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                value={filters.action || ''}
                onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="VIEW">View</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">From Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                value={filters.from || ''}
                onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                value={filters.to || ''}
                onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => setFilters({ entityType, entityId, limit: filters.limit })}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
            >
              Clear Filters
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                {!compact && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hash</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm">{formatDate(event.timestamp)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                      {formatEventType(event.eventType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      event.action === 'CREATE' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                      event.action === 'DELETE' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      {formatAction(event.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {event.entityType}: {event.entityId.substring(0, 8)}...
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-sm font-mono text-xs text-gray-500">
                      {event.hash.substring(0, 16)}...
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {events.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No audit events found
          </div>
        )}

        {/* Pagination */}
        {!compact && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * (filters.limit || 20) + 1} to {Math.min(page * (filters.limit || 20), total)} of {total} events
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
