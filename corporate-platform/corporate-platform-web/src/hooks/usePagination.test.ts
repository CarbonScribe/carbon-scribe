import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePagination } from '@/hooks/usePagination';

describe('usePagination', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 45, initialPage: 1, initialPageSize: 10 })
    );

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(10);
    expect(result.current.fromItem).toBe(1);
    expect(result.current.toItem).toBe(10);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPrevPage).toBe(false);
  });

  it('navigates through pages', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 30, initialPage: 1, initialPageSize: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.hasPrevPage).toBe(true);
    expect(result.current.hasNextPage).toBe(true);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(3);
    expect(result.current.hasNextPage).toBe(false);

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.page).toBe(2);
  });

  it('changes page size and resets page to 1', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, initialPage: 3, initialPageSize: 10, onChange })
    );

    act(() => {
      result.current.setPageSize(25);
    });

    expect(result.current.pageSize).toBe(25);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(2);
    expect(onChange).toHaveBeenCalledWith(1, 25);
  });

  it('slices array items correctly with paginateItems', () => {
    const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);
    const { result } = renderHook(() =>
      usePagination({ totalItems: items.length, initialPage: 2, initialPageSize: 10 })
    );

    const sliced = result.current.paginateItems(items);
    expect(sliced).toEqual(items.slice(10, 20));
  });

  it('jumps to first and last page', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, initialPage: 5, initialPageSize: 10 })
    );

    act(() => {
      result.current.firstPage();
    });
    expect(result.current.page).toBe(1);

    act(() => {
      result.current.lastPage();
    });
    expect(result.current.page).toBe(10);
  });
});
