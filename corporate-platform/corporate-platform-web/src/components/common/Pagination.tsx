'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
  compact?: boolean;
  showPageSizeSelector?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  compact = false,
  showPageSizeSelector = false,
  className = '',
  disabled = false,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  const from = total !== undefined ? (total === 0 ? 0 : (safePage - 1) * pageSize + 1) : undefined;
  const to = total !== undefined ? Math.min(safePage * pageSize, total) : undefined;

  return (
    <div
      className={`px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-sm ${className}`}
      role="navigation"
      aria-label="Pagination Navigation"
    >
      <div className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite" data-testid="pagination-info">
        {total !== undefined && from !== undefined && to !== undefined ? (
          <span>
            Showing <span className="font-medium text-gray-900 dark:text-white">{from}</span> to{' '}
            <span className="font-medium text-gray-900 dark:text-white">{to}</span> of{' '}
            <span className="font-medium text-gray-900 dark:text-white">{total}</span> {itemLabel}
          </span>
        ) : (
          <span>
            Page <span className="font-medium text-gray-900 dark:text-white">{safePage}</span> of{' '}
            <span className="font-medium text-gray-900 dark:text-white">{safeTotalPages}</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showPageSizeSelector && onPageSizeChange && !compact && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <label htmlFor={`page-size-select-${itemLabel}`} className="sr-only">
              Rows per page
            </label>
            <span>Rows:</span>
            <select
              id={`page-size-select-${itemLabel}`}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:ring-1 focus:ring-corporate-blue disabled:opacity-50"
              aria-label={`Select rows per page for ${itemLabel}`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={disabled || safePage <= 1}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Previous
          </button>

          <span
            className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400"
            aria-live="polite"
          >
            Page {safePage} of {safeTotalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
            disabled={disabled || safePage >= safeTotalPages}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Pagination;
