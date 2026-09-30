import { useState, useMemo, useCallback, useEffect } from 'react';

export interface UsePaginationOptions {
  totalItems?: number;
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  onChange?: (page: number, pageSize: number) => void;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  fromItem: number;
  toItem: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number | ((prev: number) => number)) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  paginateItems: <T>(items: T[]) => T[];
}

export function usePagination({
  totalItems = 0,
  initialPage = 1,
  initialPageSize = 10,
  onChange,
}: UsePaginationOptions = {}): UsePaginationReturn {
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // If page is out of bounds after totalItems decreases, adjust it
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPageState(totalPages);
    }
  }, [page, totalPages]);

  const setPage = useCallback(
    (newPageOrFn: number | ((prev: number) => number)) => {
      setPageState((prev) => {
        const next = typeof newPageOrFn === 'function' ? newPageOrFn(prev) : newPageOrFn;
        const bounded = Math.min(Math.max(1, next), totalPages);
        onChange?.(bounded, pageSize);
        return bounded;
      });
    },
    [totalPages, pageSize, onChange],
  );

  const setPageSize = useCallback(
    (newSize: number) => {
      setPageSizeState(newSize);
      setPageState(1);
      onChange?.(1, newSize);
    },
    [onChange],
  );

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages, setPage]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, [setPage]);

  const firstPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const lastPage = useCallback(() => {
    setPage(totalPages);
  }, [totalPages, setPage]);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const fromItem = totalItems === 0 ? 0 : startIndex + 1;
  const toItem = Math.min(safePage * pageSize, totalItems);

  const paginateItems = useCallback(
    <T>(items: T[]): T[] => {
      return items.slice(startIndex, startIndex + pageSize);
    },
    [startIndex, pageSize],
  );

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    fromItem,
    toItem,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    paginateItems,
  };
}

export default usePagination;
