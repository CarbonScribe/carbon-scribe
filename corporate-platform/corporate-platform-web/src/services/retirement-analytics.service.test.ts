import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api-client';
import { retirementAnalyticsService } from '@/services/retirement-analytics.service';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

const query = {
  companyId: 'company-1',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  aggregation: 'monthly' as const,
};

describe('RetirementAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls purpose-breakdown endpoint with query params', async () => {
    mockGet.mockResolvedValue({ success: true, data: { purposes: [], totalRetired: 0 } });

    await retirementAnalyticsService.getPurposeBreakdown(query);

    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/retirement-analytics/purpose-breakdown?');
    expect(calledUrl).toContain('companyId=company-1');
    expect(calledUrl).toContain('aggregation=monthly');
  });

  it('calls trends endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: { periods: [], totalRetired: 0, totalTarget: 0, aggregation: 'monthly' } });

    await retirementAnalyticsService.getTrends(query);

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/retirement-analytics/trends?'));
  });

  it('calls forecast endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: { projections: [], methodology: 'moving-average', basedOnMonths: 12 } });

    await retirementAnalyticsService.getForecast(query);

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/retirement-analytics/forecast?'));
  });

  it('calls impact endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: { co2Offset: 0, treesPlanted: 0, carsRemoved: 0, homesPowered: 0, calculationStandard: 'GHG' } });

    await retirementAnalyticsService.getImpact(query);

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/retirement-analytics/impact?'));
  });

  it('calls progress endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: { annual: { target: 0, achieved: 0, percentage: 0 }, netZero: { target: 0, achieved: 0, percentage: 0 }, onTrack: false, behindScheduleAlert: false } });

    await retirementAnalyticsService.getProgress(query);

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/retirement-analytics/progress?'));
  });

  it('calls summary endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: { purposeBreakdown: { purposes: [], totalRetired: 0, periodStart: '', periodEnd: '' }, trends: { periods: [], aggregation: 'monthly', totalRetired: 0, totalTarget: 0 }, forecast: { projections: [], methodology: 'moving-average', basedOnMonths: 12 }, impact: { co2Offset: 0, treesPlanted: 0, carsRemoved: 0, homesPowered: 0, calculationStandard: 'GHG' }, progress: { annual: { target: 0, achieved: 0, percentage: 0 }, netZero: { target: 0, achieved: 0, percentage: 0 }, onTrack: false, behindScheduleAlert: false } } });

    await retirementAnalyticsService.getSummary(query);

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/retirement-analytics/summary?'));
  });

  it('normalizes raw payloads without success envelope', async () => {
    mockGet.mockResolvedValue({ periods: [], aggregation: 'monthly', totalRetired: 0, totalTarget: 0 } as unknown as never);

    const result = await retirementAnalyticsService.getTrends(query);

    expect(result.success).toBe(true);
    expect(result.data?.aggregation).toBe('monthly');
  });

  it('preserves API error payloads', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Analytics service unavailable' });

    const result = await retirementAnalyticsService.getSummary(query);

    expect(result.success).toBe(false);
    expect(result.error).toContain('unavailable');
  });
});
