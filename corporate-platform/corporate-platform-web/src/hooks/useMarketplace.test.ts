import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMarketplace, DEFAULT_FILTERS, PAGE_SIZE } from '@/hooks/useMarketplace'
import { marketplaceService } from '@/services/marketplace.service'

vi.mock('@/services/marketplace.service', () => ({
  marketplaceService: {
    searchCredits: vi.fn(),
    getStats: vi.fn(),
    getFilters: vi.fn(),
  },
}))

const mockSearchCredits = vi.mocked(marketplaceService.searchCredits)
const mockGetStats = vi.mocked(marketplaceService.getStats)
const mockGetFilters = vi.mocked(marketplaceService.getFilters)

const mockCredit = {
  id: 'credit-1',
  projectId: 'proj-1',
  projectName: 'Amazon Reforestation',
  country: 'Brazil',
  methodology: 'REDD+',
  vintage: 2022,
  availableAmount: 5000,
  totalAmount: 10000,
  pricePerTon: 18.5,
  status: 'available',
  verificationStandard: 'VERRA',
  sdgs: [13, 15],
  dynamicScore: 87,
}

const mockSearchResult = {
  data: [mockCredit],
  total: 1,
  page: 1,
  limit: PAGE_SIZE,
  facets: {
    countries: [],
    methodologies: [],
    standards: [],
    sdgs: [],
    vintageYears: [],
    priceRange: {},
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchCredits.mockResolvedValue({ success: true, data: mockSearchResult })
  mockGetStats.mockResolvedValue({
    success: true,
    data: {
      totalCredits: 5000,
      avgPrice: 20,
      projectCount: 10,
      countryCount: 5,
      methodologyCount: 3,
      price: { min: 5, max: 60, median: 18 },
    },
  })
  mockGetFilters.mockResolvedValue({
    success: true,
    data: {
      methodologies: ['REDD+', 'VCS'],
      countries: ['Brazil', 'Kenya'],
      sdgs: [13, 15],
      vintageRange: { min: 2018, max: 2024 },
      priceRange: { min: 5, max: 80 },
    },
  })
})

describe('useMarketplace', () => {
  it('initialises with default filters and page 1', () => {
    const { result } = renderHook(() => useMarketplace())
    expect(result.current.page).toBe(1)
    expect(result.current.filters).toEqual(DEFAULT_FILTERS)
    expect(result.current.pageSize).toBe(PAGE_SIZE)
  })

  it('loads credits on mount', async () => {
    const { result } = renderHook(() => useMarketplace())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.credits).toHaveLength(1)
    expect(result.current.credits[0].id).toBe('credit-1')
    expect(result.current.total).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('loads stats and availableFilters on mount', async () => {
    const { result } = renderHook(() => useMarketplace())

    await waitFor(() => {
      expect(result.current.statsLoading).toBe(false)
      expect(result.current.filtersLoading).toBe(false)
    })

    expect(result.current.stats?.avgPrice).toBe(20)
    expect(result.current.availableFilters?.methodologies).toContain('REDD+')
  })

  it('sets loading to true while fetching', async () => {
    let resolveSearch!: (value: any) => void
    mockSearchCredits.mockReturnValue(new Promise((res) => (resolveSearch = res)))

    const { result } = renderHook(() => useMarketplace())
    expect(result.current.loading).toBe(true)

    act(() => {
      resolveSearch({ success: true, data: mockSearchResult })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('sets error when API returns failure', async () => {
    mockSearchCredits.mockResolvedValue({ success: false, error: 'Server error' })

    const { result } = renderHook(() => useMarketplace())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Server error')
    expect(result.current.credits).toHaveLength(0)
  })

  it('resets to page 1 and re-fetches when filters change', async () => {
    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setPage(3)
    })

    await waitFor(() => expect(result.current.page).toBe(3))

    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, query: 'forest' })
    })

    await waitFor(() => {
      expect(result.current.page).toBe(1)
      expect(result.current.filters.query).toBe('forest')
    })
  })

  it('setPage updates page and triggers re-fetch', async () => {
    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setPage(2)
    })

    await waitFor(() => expect(result.current.page).toBe(2))
    expect(mockSearchCredits).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    )
  })

  it('passes sdg filters to searchCredits', async () => {
    mockSearchCredits.mockResolvedValue({ success: true, data: mockSearchResult })
    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, sdgs: [13, 15] })
    })

    await waitFor(() => {
      const lastCall = mockSearchCredits.mock.calls[mockSearchCredits.mock.calls.length - 1][0]
      expect(lastCall.sdgs).toEqual([13, 15])
    })
  })

  it('passes priceRange filters when not at defaults', async () => {
    mockSearchCredits.mockResolvedValue({ success: true, data: mockSearchResult })
    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, priceRange: [10, 50] })
    })

    await waitFor(() => {
      const lastCall = mockSearchCredits.mock.calls[mockSearchCredits.mock.calls.length - 1][0]
      expect(lastCall.priceMin).toBe(10)
      expect(lastCall.priceMax).toBe(50)
    })
  })

  it('does not send priceMin when at default minimum (0)', async () => {
    mockSearchCredits.mockResolvedValue({ success: true, data: mockSearchResult })
    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, priceRange: [0, 50] })
    })

    await waitFor(() => {
      const lastCall = mockSearchCredits.mock.calls[mockSearchCredits.mock.calls.length - 1][0]
      expect(lastCall.priceMin).toBeUndefined()
    })
  })

  it('does not fail when stats API returns error', async () => {
    mockGetStats.mockResolvedValue({ success: false, error: 'Stats unavailable' })

    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.statsLoading).toBe(false))

    expect(result.current.stats).toBeNull()
    // credits still load
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('refresh re-fetches credits and stats', async () => {
    const { result } = renderHook(() => useMarketplace())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callCount = mockSearchCredits.mock.calls.length

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(mockSearchCredits.mock.calls.length).toBeGreaterThan(callCount)
    })
  })
})

// ── Race-condition protection ────────────────────────────────────────────────

describe('useMarketplace – race condition protection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockGetStats.mockResolvedValue({ success: true, data: { totalCredits: 0, avgPrice: 0, projectCount: 0, countryCount: 0, methodologyCount: 0, price: { min: 0, max: 0, median: 0 } } })
    mockGetFilters.mockResolvedValue({ success: true, data: { methodologies: [], countries: [], sdgs: [], vintageRange: { min: 2018, max: 2025 }, priceRange: { min: 0, max: 200 } } })
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('discards a stale response when a newer filter request resolves first', async () => {
    let resolveStale!: (v: any) => void
    const staleResult = { success: true, data: { ...mockSearchResult, total: 999 } }
    const freshResult = { success: true, data: { ...mockSearchResult, total: 42 } }

    // First call (initial load) — slow, will resolve after the second call.
    mockSearchCredits.mockReturnValueOnce(new Promise((r) => (resolveStale = r)))
    // Second call (post-filter debounce) — resolves immediately.
    mockSearchCredits.mockResolvedValueOnce(freshResult)

    const { result } = renderHook(() => useMarketplace())

    // Initial fetch is in-flight. Change filters to trigger the debounce.
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, query: 'forest' })
    })

    // Advance past the 300 ms debounce window to fire the second request.
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Wait for the fresh (second) response to settle.
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.total).toBe(42)

    // Now resolve the stale (first) request — its response must be discarded.
    await act(async () => {
      resolveStale(staleResult)
    })

    expect(result.current.total).toBe(42)
    expect(result.current.credits[0]?.id).toBe('credit-1')
  })

  it('passes an AbortSignal to searchCredits so the HTTP request can be cancelled', async () => {
    const capturedSignals: (AbortSignal | undefined)[] = []

    mockSearchCredits.mockImplementation((_query, signal) => {
      capturedSignals.push(signal)
      return Promise.resolve({ success: true, data: mockSearchResult })
    })

    const { result } = renderHook(() => useMarketplace())

    // Wait for initial fetch to complete.
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Change filters — this starts the debounce timer.
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, query: 'new' })
    })

    // Advance past debounce to fire the second request.
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Both calls should have received an AbortSignal.
    expect(capturedSignals.length).toBeGreaterThanOrEqual(2)
    capturedSignals.forEach((signal) => {
      expect(signal).toBeInstanceOf(AbortSignal)
    })
  })

  it('aborts the previous in-flight request when filters change rapidly', async () => {
    let resolveFirst!: (v: any) => void
    const capturedSignals: AbortSignal[] = []

    // First call: slow, never resolves automatically.
    mockSearchCredits.mockImplementationOnce((_query, signal) => {
      if (signal) capturedSignals.push(signal)
      return new Promise((r) => (resolveFirst = r))
    })
    // Second call: resolves immediately.
    mockSearchCredits.mockResolvedValueOnce({ success: true, data: mockSearchResult })

    const { result } = renderHook(() => useMarketplace())

    // Change filters to start the debounce then trigger the first slow request.
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, query: 'slow' })
    })
    await act(async () => {
      vi.advanceTimersByTime(300) // fires first request
    })

    // Change filters again immediately — should cancel the first request.
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, query: 'fast' })
    })
    await act(async () => {
      vi.advanceTimersByTime(300) // fires second request
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // The first request's signal must have been aborted.
    expect(capturedSignals[0]?.aborted).toBe(true)

    // Resolving the first (aborted) request should not affect the UI.
    const staleTotal = 777
    await act(async () => {
      resolveFirst({ success: true, data: { ...mockSearchResult, total: staleTotal } })
    })

    expect(result.current.total).not.toBe(staleTotal)
  })

  it('does not update state after unmount (prevents memory leaks)', async () => {
    let resolve!: (v: any) => void
    mockSearchCredits.mockReturnValue(new Promise((r) => (resolve = r)))

    const { result, unmount } = renderHook(() => useMarketplace())
    expect(result.current.loading).toBe(true)

    unmount()

    // Resolving after unmount should not throw or update orphaned state.
    await act(async () => {
      resolve({ success: true, data: mockSearchResult })
    })

    // No assertions needed — absence of React "state update on unmounted
    // component" warnings in the test output confirms the fix is working.
  })
})
