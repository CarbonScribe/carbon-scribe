import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api-client';
import { retirementSchedulingService } from '@/services/retirement-scheduling.service';
import type { ScheduledRetirement } from '@/types/retirement-scheduling';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const schedule: ScheduledRetirement = {
  id: 'sched-1',
  companyId: 'company-1',
  userId: 'user-1',
  name: 'Quarterly Scope 2 Retirement',
  description: 'Retire for electricity offsets',
  purpose: 'scope2',
  amount: 1200,
  creditSelection: 'automatic',
  creditIds: [],
  frequency: 'quarterly',
  interval: 1,
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: null,
  nextRunDate: '2026-06-01T00:00:00.000Z',
  timezone: 'UTC',
  isActive: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  lastRunDate: null,
  lastRunStatus: null,
  runCount: 0,
  notifyBefore: 3,
  notifyAfter: true,
};

describe('RetirementSchedulingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a schedule via POST /retirement-scheduling', async () => {
    mockPost.mockResolvedValue({ success: true, data: schedule });

    const result = await retirementSchedulingService.createSchedule({
      name: schedule.name,
      purpose: schedule.purpose,
      amount: schedule.amount,
      creditSelection: schedule.creditSelection,
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      notifyBefore: 3,
    });

    expect(mockPost).toHaveBeenCalledWith('/retirement-scheduling', {
      name: schedule.name,
      purpose: schedule.purpose,
      amount: schedule.amount,
      creditSelection: schedule.creditSelection,
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      notifyBefore: 3,
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('sched-1');
  });

  it('lists schedules via GET /retirement-scheduling', async () => {
    mockGet.mockResolvedValue({ success: true, data: [schedule] });

    const result = await retirementSchedulingService.listSchedules();

    expect(mockGet).toHaveBeenCalledWith('/retirement-scheduling');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('gets schedule details via GET /retirement-scheduling/:id', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...schedule, executions: [] } });

    const result = await retirementSchedulingService.getScheduleById('sched-1');

    expect(mockGet).toHaveBeenCalledWith('/retirement-scheduling/sched-1');
    expect(result.data?.id).toBe('sched-1');
  });

  it('updates schedule via PUT /retirement-scheduling/:id', async () => {
    mockPut.mockResolvedValue({ success: true, data: { ...schedule, amount: 2000 } });

    const result = await retirementSchedulingService.updateSchedule('sched-1', {
      amount: 2000,
      notifyBefore: 7,
    });

    expect(mockPut).toHaveBeenCalledWith('/retirement-scheduling/sched-1', {
      amount: 2000,
      notifyBefore: 7,
    });
    expect(result.data?.amount).toBe(2000);
  });

  it('cancels schedule via DELETE /retirement-scheduling/:id', async () => {
    mockDelete.mockResolvedValue({ success: true, data: { deleted: true } });

    const result = await retirementSchedulingService.cancelSchedule('sched-1');

    expect(mockDelete).toHaveBeenCalledWith('/retirement-scheduling/sched-1');
    expect(result.data?.deleted).toBe(true);
  });

  it('normalizes raw backend payloads without success wrapper', async () => {
    mockGet.mockResolvedValue([schedule] as unknown as never);

    const result = await retirementSchedulingService.listSchedules();

    expect(result.success).toBe(true);
    expect(result.data?.[0].id).toBe('sched-1');
  });

  it('preserves API errors for edge cases', async () => {
    mockPut.mockResolvedValue({ success: false, error: 'Conflicting schedule at this time' });

    const result = await retirementSchedulingService.updateSchedule('sched-1', {
      startDate: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Conflicting schedule');
  });
});
