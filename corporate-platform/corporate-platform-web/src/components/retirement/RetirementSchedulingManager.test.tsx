import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RetirementSchedulingManager from '@/components/retirement/RetirementSchedulingManager'

const listSchedulesMock = vi.fn()
const createScheduleMock = vi.fn()
const updateScheduleMock = vi.fn()
const cancelScheduleMock = vi.fn()

vi.mock('@/services/retirement-scheduling.service', () => ({
  retirementSchedulingService: {
    listSchedules: (...args: unknown[]) => listSchedulesMock(...args),
    createSchedule: (...args: unknown[]) => createScheduleMock(...args),
    updateSchedule: (...args: unknown[]) => updateScheduleMock(...args),
    cancelSchedule: (...args: unknown[]) => cancelScheduleMock(...args),
  },
}))

const baseSchedule = {
  id: 'sched-1',
  companyId: 'company-1',
  userId: 'user-1',
  name: 'Monthly Scope 1 Retirement',
  description: null,
  purpose: 'scope1' as const,
  amount: 700,
  creditSelection: 'automatic' as const,
  creditIds: [],
  frequency: 'monthly' as const,
  interval: 1,
  startDate: new Date().toISOString(),
  endDate: null,
  nextRunDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  timezone: 'UTC',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastRunDate: null,
  lastRunStatus: null,
  runCount: 0,
  notifyBefore: 3,
  notifyAfter: true,
}

describe('RetirementSchedulingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSchedulesMock.mockResolvedValue({ success: true, data: [baseSchedule] })
    createScheduleMock.mockResolvedValue({ success: true, data: baseSchedule })
    updateScheduleMock.mockResolvedValue({ success: true, data: baseSchedule })
    cancelScheduleMock.mockResolvedValue({ success: true, data: { deleted: true } })
  })

  it('renders existing schedules and reminders', async () => {
    render(<RetirementSchedulingManager />)

    expect((await screen.findAllByText('Monthly Scope 1 Retirement')).length).toBeGreaterThan(0)
    expect(screen.getByText('Upcoming Retirement Reminders')).toBeInTheDocument()
  })

  it('creates a new schedule from form submission', async () => {
    render(<RetirementSchedulingManager />)

    await screen.findAllByText('Monthly Scope 1 Retirement')

    fireEvent.change(screen.getByPlaceholderText('Schedule name'), {
      target: { value: 'Quarterly Scope 3 Plan' },
    })

    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: '1200' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Schedule' }))

    await waitFor(() => {
      expect(createScheduleMock).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('Scheduled retirement created.')).toBeInTheDocument()
  })

  it('cancels a schedule from the schedule list', async () => {
    render(<RetirementSchedulingManager />)

    await screen.findAllByText('Monthly Scope 1 Retirement')

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(cancelScheduleMock).toHaveBeenCalledWith('sched-1')
    })

    expect(await screen.findByText('Scheduled retirement cancelled.')).toBeInTheDocument()
  })

  it('shows API errors from create flow', async () => {
    createScheduleMock.mockResolvedValue({ success: false, error: 'Conflicting schedule window' })

    render(<RetirementSchedulingManager />)

    await screen.findAllByText('Monthly Scope 1 Retirement')

    fireEvent.change(screen.getByPlaceholderText('Schedule name'), {
      target: { value: 'Conflicting Plan' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Schedule' }))

    expect(await screen.findByText('Conflicting schedule window')).toBeInTheDocument()
  })
})
