'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { queryAuditEvents, exportAuditEvents } from '@/lib/api/audit.api';
import type { AuditEvent, AuditQueryParams, AuditEventType, AuditAction } from '@/types/audit.types';
import { formatDate, formatEventType, formatAction } from '@/lib/utils/audit-formatters';
import { reportError } from '@/lib/telemetry/errorReporter';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { IconButton } from '@/components/common/IconButton';
import { AccessibleIcon } from '@/components/common/AccessibleIcon';
import { Pagination } from '@/components/common/Pagination';

interface AuditTrailViewerProps {
  entityType?: string;
  entityId?: string;
  compact?: boolean;
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  documentId?: string;
}

export default function AuditTrailViewer({ 
  entityType, 
  entityId, 
  compact,
  isModal = false,
  isOpen = true,
  onClose = () => {},
  documentId,
}: AuditTrailViewerProps) {
  const { labels } = useAccessibility();
  const { announce } = useAnnouncement();
  
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

  // Refs for focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 5,
    initialRect: { width: 1000, height: 400 },
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  const rowsToRender =
    virtualRows.length > 0
      ? virtualRows.map((vr) => ({
          index: vr.index,
          key: vr.key,
          event: events[vr.index],
          measureRef: rowVirtualizer.measureElement,
        }))
      : events.map((event, idx) => ({
          index: idx,
          key: event.id || idx,
          event,
          measureRef: undefined,
        }));

  useEffect(() => {
    loadEvents();
  }, [filters, page]);

  // Focus management for modal
  useEffect(() => {
    if (!isModal || !isOpen) return;

    // Store the currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the container or title
    const focusTarget = titleRef.current || containerRef.current;
    if (focusTarget) {
      setTimeout(() => {
        focusTarget.focus();
      }, 100);
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isModal, isOpen]);

  // Focus trap for modal
  useEffect(() => {
    if (!isModal || !isOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, [isModal, isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isModal || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, isOpen, onClose]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await queryAuditEvents({ ...filters, page });
      setEvents(response.events);
      setTotal(response.total);
      if (response.events.length > 0) {
        announce(`Loaded ${response.events.length} audit events`, 'polite');
      }
    } catch (err: any) {
      const message = err.message || 'Failed to load audit events';
      setError(message);
      announce(`Error loading audit events: ${message}`, 'assertive');
      reportError(err, 'AuditTrailViewer', 'error', { operation: 'loadEvents' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      announce(`Exporting audit events as ${format.toUpperCase()}`, 'polite');
      const blob = await exportAuditEvents({ ...filters, format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-events-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      announce(`Export completed successfully`, 'polite');
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to export as ${format}`;
      announce(`Export failed: ${message}`, 'assertive');
      reportError(err, 'AuditTrailViewer', 'error', { operation: 'export', format });
    }
  };

  const handleFilterChange = (key: keyof AuditQueryParams, value: any) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
    announce(`Filter applied: ${key}`, 'polite');
  };

  const handleClearFilters = () => {
    setFilters({ entityType, entityId, limit: filters.limit });
    setPage(1);
    announce('Filters cleared', 'polite');
  };

  const totalPages = Math.ceil(total / (filters.limit || 20));

  const getTitleId = 'audit-trail-title';
  const getDescId = 'audit-trail-desc';

  // ── Loading State ──
  if (loading) {
    return (
      <div 
        className="p-8 text-center text-gray-500 dark:text-gray-400"
        role="status"
        aria-live="polite"
        aria-label="Loading audit events"
      >
        <div className="flex flex-col items-center gap-3">
          <div 
            className="h-8 w-8 animate-spin rounded-full border-4 border-corporate-blue border-t-transparent"
            aria-hidden="true"
          />
          <span>Loading audit trail...</span>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div 
        className="p-8 text-center text-red-600 dark:text-red-400"
        role="alert"
        aria-live="assertive"
        aria-label="Error loading audit events"
      >
        <AccessibleIcon hidden aria-hidden="true">
          <span className="text-3xl block mb-2">⚠️</span>
        </AccessibleIcon>
        <p>{error}</p>
        <button
          onClick={loadEvents}
          className="mt-4 px-4 py-2 bg-corporate-blue text-white rounded-lg hover:bg-corporate-blue/90"
          aria-label="Retry loading audit events"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Main Content ──
  const content = (
    <div
      ref={containerRef}
      tabIndex={isModal ? -1 : undefined}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? 'true' : undefined}
      aria-labelledby={getTitleId}
      aria-describedby={getDescId}
      className={`focus:outline-none ${isModal ? 'w-full max-w-4xl bg-white dark:bg-gray-900 rounded-lg p-6 shadow-xl' : ''}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-3 dark:border-gray-800">
        <div>
          <h2 
            ref={titleRef}
            id={getTitleId}
            tabIndex={-1}
            className="text-xl font-bold text-gray-900 dark:text-white focus:outline-none"
          >
            {isModal ? `Document Audit Trail (${documentId || 'Unknown'})` : 'Audit Trail'}
            <span className="sr-only"> - {events.length} events</span>
          </h2>
          {!isModal && (
            <p id={getDescId} className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Showing chronological history and proof of verification
            </p>
          )}
        </div>
        {isModal && (
          <IconButton
            ref={closeButtonRef}
            label={labels.closeCart}
            onClick={onClose}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            <AccessibleIcon hidden aria-hidden="true">
              <span>✕</span>
            </AccessibleIcon>
            <span className="sr-only">Close audit trail</span>
          </IconButton>
        )}
      </div>

      {isModal && (
        <p id={getDescId} className="text-sm text-gray-500 mt-2 mb-4 dark:text-gray-400">
          Showing chronological history and proof of verification.
        </p>
      )}

      {/* Filters */}
      {!compact && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="event-type-filter" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Event Type
              </label>
              <select
                id="event-type-filter"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-200"
                value={filters.eventType || ''}
                onChange={(e) => handleFilterChange('eventType', e.target.value || undefined)}
                aria-label="Filter by event type"
              >
                <option value="">All Types</option>
                <option value="RETIREMENT">Retirement</option>
                <option value="COMPLIANCE_REPORT">Compliance Report</option>
                <option value="GHG_CALCULATION">GHG Calculation</option>
                <option value="USER_ACTION">User Action</option>
              </select>
            </div>

            <div>
              <label htmlFor="action-filter" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Action
              </label>
              <select
                id="action-filter"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-200"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
                aria-label="Filter by action"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="VIEW">View</option>
              </select>
            </div>

            <div>
              <label htmlFor="from-date" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                From Date
              </label>
              <input
                id="from-date"
                type="date"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-200"
                value={filters.from || ''}
                onChange={(e) => handleFilterChange('from', e.target.value || undefined)}
                aria-label="Filter from date"
              />
            </div>

            <div>
              <label htmlFor="to-date" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                To Date
              </label>
              <input
                id="to-date"
                type="date"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-200"
                value={filters.to || ''}
                onChange={(e) => handleFilterChange('to', e.target.value || undefined)}
                aria-label="Filter to date"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Clear all filters"
            >
              Clear Filters
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm focus:ring-2 focus:ring-blue-500"
                aria-label="Export audit events as CSV"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm focus:ring-2 focus:ring-green-500"
                aria-label="Export audit events as JSON"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-4">
        <div ref={tableContainerRef} className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table 
            className="w-full"
            role="table"
            aria-label="Audit events"
          >
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
              <tr role="row">
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Timestamp
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Event Type
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entity
                </th>
                {!compact && (
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hash
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={compact ? 4 : 5} style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} />
                </tr>
              )}
              {rowsToRender.map(({ index, key, event, measureRef }) => {
                if (!event) return null;
                return (
                  <tr 
                    key={event.id || key} 
                    data-index={index}
                    ref={measureRef}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    role="row"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
                      {formatDate(event.timestamp)}
                    </td>
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
                      <td className="px-4 py-3 text-sm font-mono text-xs text-gray-500 dark:text-gray-400">
                        {event.hash.substring(0, 16)}...
                      </td>
                    )}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={compact ? 4 : 5} style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {events.length === 0 && (
          <div 
            className="p-8 text-center text-gray-500 dark:text-gray-400"
            role="status"
            aria-live="polite"
          >
            No audit events found
          </div>
        )}

        {/* Pagination */}
        {!compact && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={filters.limit || 20}
            itemLabel="events"
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => {
              setFilters((prev) => ({ ...prev, limit: newSize }));
              setPage(1);
            }}
            showPageSizeSelector
          />
        )}
      </div>
    </div>
  );

  // ── Modal Wrapper ─────────────────────────────────────────────────────────
  if (isModal) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        {content}
      </div>
    );
  }

  return content;
}