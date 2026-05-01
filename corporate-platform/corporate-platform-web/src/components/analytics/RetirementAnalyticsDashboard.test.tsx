import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RetirementAnalyticsDashboard from '@/components/analytics/RetirementAnalyticsDashboard'

const getSummaryMock = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', companyId: 'company-1', role: 'admin' },
  }),
}))

vi.mock('@/services/retirement-analytics.service', () => ({
  retirementAnalyticsService: {
    getSummary: (...args: unknown[]) => getSummaryMock(...args),
  },
}))

const summaryFixture = {
  purposeBreakdown: {
    purposes: [
      { name: 'scope1', amount: 1200, percentage: 60, color: '#0073e6' },
      { name: 'scope2', amount: 800, percentage: 40, color: '#00d4aa' },
    ],
    totalRetired: 2000,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  },
  trends: {
    periods: [
      { month: 'Jan', retired: 300, target: 250, cumulative: 300 },
      { month: 'Feb', retired: 280, target: 250, cumulative: 580 },
    ],
    aggregation: 'monthly' as const,
    totalRetired: 580,
    totalTarget: 500,
    yearOverYearChange: 12.4,
  },
  forecast: {
    projections: [
      { period: 'Mar', predicted: 320, confidence: { lower: 280, upper: 360 } },
      { period: 'Apr', predicted: 340, confidence: { lower: 300, upper: 380 } },
    ],
    methodology: 'moving-average',
    basedOnMonths: 12,
  },
  impact: {
    co2Offset: 2000,
    treesPlanted: 90909,
    carsRemoved: 435,
    homesPowered: 266,
    calculationStandard: 'GHG',
  },
  progress: {
    annual: { target: 5000, achieved: 2000, percentage: 40 },
    netZero: { target: 25000, achieved: 8000, percentage: 32 },
    onTrack: true,
    behindScheduleAlert: false,
  },
}

describe('RetirementAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders summary metrics when analytics data loads', async () => {
    getSummaryMock.mockResolvedValue({ success: true, data: summaryFixture })

    render(<RetirementAnalyticsDashboard />)

    expect(await screen.findByText('Retirement Analytics')).toBeInTheDocument()
    expect((await screen.findAllByText('2,000 tCO2')).length).toBeGreaterThan(0)
    expect(await screen.findByText('Purpose Breakdown')).toBeInTheDocument()
  })

  it('renders empty state when analytics has no periods and purposes', async () => {
    getSummaryMock.mockResolvedValue({
      success: true,
      data: {
        ...summaryFixture,
        purposeBreakdown: { ...summaryFixture.purposeBreakdown, purposes: [] },
        trends: { ...summaryFixture.trends, periods: [] },
      },
    })

    render(<RetirementAnalyticsDashboard />)

    expect(
      await screen.findByText('No retirement analytics found for the selected date range and filters.'),
    ).toBeInTheDocument()
  })

  it('renders error state when analytics fetch fails', async () => {
    getSummaryMock.mockResolvedValue({ success: false, error: 'Failed analytics fetch' })

    render(<RetirementAnalyticsDashboard />)

    expect(await screen.findByText('Failed analytics fetch')).toBeInTheDocument()
  })

  it('passes scoped query to summary endpoint', async () => {
    getSummaryMock.mockResolvedValue({ success: true, data: summaryFixture })

    render(<RetirementAnalyticsDashboard />)

    await waitFor(() => {
      expect(getSummaryMock).toHaveBeenCalledTimes(1)
    })

    expect(getSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        aggregation: 'monthly',
      }),
    )
  })
})
