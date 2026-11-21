import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectFilters from './ProjectFilters';

const mockSetFilters = vi.hoisted(() => vi.fn());

vi.mock('@/lib/store/store', () => ({
  useStore: (selector: (state: unknown) => unknown) =>
    selector({
      filters: { search: '', type: 'All', status: 'All' },
      setFilters: mockSetFilters,
    }),
}));

describe('ProjectFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSetFilters.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits only the latest search value after 300 ms', () => {
    render(<ProjectFilters />);
    const search = screen.getByPlaceholderText('Search projects by name or location...');

    fireEvent.change(search, { target: { value: 'f' } });
    fireEvent.change(search, { target: { value: 'fo' } });
    fireEvent.change(search, { target: { value: 'forest' } });

    expect(mockSetFilters).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(299));
    expect(mockSetFilters).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(mockSetFilters).toHaveBeenCalledTimes(1);
    expect(mockSetFilters).toHaveBeenCalledWith({ search: 'forest' });
  });
});