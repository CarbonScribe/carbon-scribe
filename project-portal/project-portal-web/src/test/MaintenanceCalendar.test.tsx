import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MaintenanceCalendar from '@/components/monitoring/reports/MaintenanceCalendar'
import { useStore } from '@/lib/store/store'
import type { MaintenanceEvent } from '@/lib/store/health/health.types'

const defaultHealthState = {
  maintenanceEvents: [] as MaintenanceEvent[],
  healthLoading: {
    isFetchingStatus: false,
    isFetchingServices: false,
    isFetchingMetrics: false,
    isFetchingAlerts: false,
    isFetchingDependencies: false,
    isAcknowledgingAlert: false,
    isFetchingUptime: false,
    isFetchingMaintenance: false,
  },
  healthErrors: {
    status: null,
    services: null,
    metrics: null,
    alerts: null,
    dependencies: null,
    acknowledge: null,
    uptime: null,
    maintenance: null,
  },
  fetchMaintenanceSchedule: vi.fn(),
}

function resetStore(stateOverrides = {}) {
  useStore.setState({
    ...defaultHealthState,
    ...stateOverrides,
  })
}

const NOW = new Date('2026-01-15T12:00:00Z')

const events: MaintenanceEvent[] = [
  {
    id: 'evt-past',
    title: 'Database Migration v4',
    startTime: '2026-01-10T02:00:00Z',
    endTime: '2026-01-10T03:15:00Z',
  },
  {
    id: 'evt-active',
    title: 'Network Failover Test',
    startTime: '2026-01-15T11:00:00Z',
    endTime: '2026-01-15T13:00:00Z',
  },
  {
    id: 'evt-future',
    title: 'Redis Cache Upgrade',
    startTime: '2026-01-20T04:00:00Z',
    endTime: '2026-01-20T04:30:00Z',
  },
]

describe('MaintenanceCalendar', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW)
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('calls fetchMaintenanceSchedule on mount', () => {
    const fetchMaintenanceSchedule = vi.fn()
    resetStore({ fetchMaintenanceSchedule })

    render(<MaintenanceCalendar />)

    expect(fetchMaintenanceSchedule).toHaveBeenCalledTimes(1)
  })

  it('renders a loading skeleton while fetching', () => {
    resetStore({
      healthLoading: { ...defaultHealthState.healthLoading, isFetchingMaintenance: true },
    })

    const { container } = render(<MaintenanceCalendar />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders an empty state when there are no maintenance events', () => {
    resetStore({ maintenanceEvents: [] })

    render(<MaintenanceCalendar />)

    expect(screen.getByText(/no scheduled maintenance/i)).toBeVisible()
  })

  it('renders an error state with a retry affordance when the fetch fails', async () => {
    const fetchMaintenanceSchedule = vi.fn()
    resetStore({
      healthErrors: { ...defaultHealthState.healthErrors, maintenance: 'Network failure' },
      fetchMaintenanceSchedule,
    })
    const user = userEvent.setup()

    render(<MaintenanceCalendar />)

    expect(screen.getByText(/network failure/i)).toBeVisible()
    // Once on mount, once more from clicking retry.
    fetchMaintenanceSchedule.mockClear()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(fetchMaintenanceSchedule).toHaveBeenCalledTimes(1)
  })

  it('renders fetched events from the store with status derived from their timestamps', () => {
    resetStore({ maintenanceEvents: events })

    render(<MaintenanceCalendar />)

    const pastCard = screen.getByText('Database Migration v4').closest('div')
    expect(pastCard).toBeTruthy()
    expect(within(pastCard as HTMLElement).getByText('Completed')).toBeVisible()

    const activeCard = screen.getByText('Network Failover Test').closest('div')
    expect(activeCard).toBeTruthy()
    expect(within(activeCard as HTMLElement).getByText('In Progress')).toBeVisible()

    const futureCard = screen.getByText('Redis Cache Upgrade').closest('div')
    expect(futureCard).toBeTruthy()
    expect(within(futureCard as HTMLElement).getByText('Upcoming')).toBeVisible()
  })

  it('opens a full calendar dialog listing every event when "View Full Calendar" is clicked', async () => {
    resetStore({ maintenanceEvents: events })
    const user = userEvent.setup()

    render(<MaintenanceCalendar />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /view full calendar/i }))

    const dialog = screen.getByRole('dialog', { name: /full maintenance calendar/i })
    expect(dialog).toBeVisible()
    expect(within(dialog).getAllByText('Database Migration v4').length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText('Network Failover Test').length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText('Redis Cache Upgrade').length).toBeGreaterThan(0)
  })
})
