import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SystemStatusBanner from '@/components/monitoring/dashboard/SystemStatusBanner'
import { useStore } from '@/lib/store/store'
import type { SystemStatusSnapshot } from '@/lib/store/health/health.types'

const defaultHealthState = {
  detailedStatus: null,
  healthLoading: {
    isFetchingStatus: false,
    isFetchingServices: false,
    isFetchingMetrics: false,
    isFetchingAlerts: false,
    isFetchingDependencies: false,
    isAcknowledgingAlert: false,
  },
  healthErrors: {
    status: null,
    services: null,
    metrics: null,
    alerts: null,
    dependencies: null,
    acknowledge: null,
  },
  fetchDetailedStatus: vi.fn(),
}

const createDetailedStatus = (overrides: Partial<SystemStatusSnapshot> = {}): SystemStatusSnapshot => ({
  overallStatus: 'Healthy',
  timestamp: '2026-01-01T12:00:00Z',
  activeAlertsCount: 2,
  healthyServicesCount: 4,
  totalServicesCount: 5,
  uptimeStats: [],
  ...overrides,
})

function resetStore(stateOverrides = {}) {
  useStore.setState({
    ...defaultHealthState,
    ...stateOverrides,
  })
}

describe('SystemStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders a loading placeholder while health status is fetching', () => {
    resetStore({ healthLoading: { ...defaultHealthState.healthLoading, isFetchingStatus: true } })
    render(<SystemStatusBanner />)

    expect(screen.getByText(/Checking system status/i)).toBeVisible()
  })

  it('renders an error banner when the health data request fails', () => {
    resetStore({ healthErrors: { ...defaultHealthState.healthErrors, status: 'Network failure' } })
    render(<SystemStatusBanner />)

    expect(screen.getByText(/Unable to load system health/i)).toBeVisible()
    expect(screen.getByText(/Network failure/i)).toBeVisible()
  })

  it('renders live detailedStatus snapshot and updates when the store changes', async () => {
    const snapshot = createDetailedStatus({ overallStatus: 'Healthy', activeAlertsCount: 3, healthyServicesCount: 4, totalServicesCount: 5 })
    resetStore({ detailedStatus: snapshot })

    render(<SystemStatusBanner />)

    expect(screen.getByRole('heading', { name: /Healthy/i })).toBeVisible()

    const activeAlerts = screen.getByText(/Active alerts/i).closest('div')
    expect(activeAlerts).toBeTruthy()
    expect(within(activeAlerts as HTMLElement).getByText('3')).toBeVisible()

    const affectedServices = screen.getByText(/Affected services/i).closest('div')
    expect(affectedServices).toBeTruthy()
    expect(within(affectedServices as HTMLElement).getByText('1')).toBeVisible()

    const healthyServices = screen.getByText(/Healthy services/i).closest('div')
    expect(healthyServices).toBeTruthy()
    expect(within(healthyServices as HTMLElement).getByText('4/5')).toBeVisible()

    expect(screen.getByText(/Last updated/i)).toBeVisible()

    act(() => {
      useStore.setState({
        detailedStatus: createDetailedStatus({
          overallStatus: 'Degraded',
          activeAlertsCount: 5,
          healthyServicesCount: 2,
          totalServicesCount: 5,
          timestamp: '2026-01-01T12:05:00Z',
        }),
      })
    })

    expect(screen.getByRole('heading', { name: /Degraded/i })).toBeVisible()
    const updatedAlerts = screen.getByText(/Active alerts/i).closest('div')
    expect(updatedAlerts).toBeTruthy()
    expect(within(updatedAlerts as HTMLElement).getByText('5')).toBeVisible()

    const updatedAffected = screen.getByText(/Affected services/i).closest('div')
    expect(updatedAffected).toBeTruthy()
    expect(within(updatedAffected as HTMLElement).getByText('3')).toBeVisible()
  })

  it('calls fetchDetailedStatus on mount and refreshes on a polling interval', () => {
    const mockFetchDetailedStatus = vi.fn()
    resetStore({ fetchDetailedStatus: mockFetchDetailedStatus })

    render(<SystemStatusBanner />)

    expect(mockFetchDetailedStatus).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(mockFetchDetailedStatus).toHaveBeenCalledTimes(2)
  })
})
