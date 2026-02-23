import { ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      retirementSchedule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      scheduleExecution: { findMany: jest.fn() },
    };
    service = new ScheduleService(prisma);
  });

  it('calculates monthly next run date', () => {
    const base = new Date('2026-01-15T00:00:00.000Z');
    const result = service.calculateNextRunDate(base, 'monthly');
    expect(result.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });

  it('calculates quarterly next run date', () => {
    const base = new Date('2026-01-15T00:00:00.000Z');
    const result = service.calculateNextRunDate(base, 'quarterly');
    expect(result.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('calculates annual next run date', () => {
    const base = new Date('2026-01-15T00:00:00.000Z');
    const result = service.calculateNextRunDate(base, 'annual');
    expect(result.toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('returns same date for one-time frequency', () => {
    const base = new Date('2026-06-10T00:00:00.000Z');
    const result = service.calculateNextRunDate(base, 'one-time');
    expect(result.toISOString()).toBe('2026-06-10T00:00:00.000Z');
  });

  it('applies interval for monthly (interval 2 = +2 months)', () => {
    const base = new Date('2026-01-15T00:00:00.000Z');
    const result = service.calculateNextRunDate(base, 'monthly', 2);
    expect(result.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('applies interval for quarterly (interval 2 = +6 months)', () => {
    const base = new Date('2026-01-15T00:00:00.000Z');
    const result = service.calculateNextRunDate(base, 'quarterly', 2);
    expect(result.toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('update does not change nextRunDate when only name is updated', async () => {
    const existing = {
      id: 's1',
      companyId: 'c1',
      name: 'Old',
      nextRunDate: new Date('2026-06-01'),
      runCount: 1,
      lastRunDate: new Date('2026-05-01'),
      frequency: 'monthly',
      interval: null,
      startDate: new Date('2026-01-01'),
      endDate: null,
      purpose: 'scope1',
      amount: 100,
      creditSelection: 'automatic' as const,
      creditIds: [] as string[],
      description: null,
      notifyBefore: 3,
      notifyAfter: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastRunStatus: 'success',
      createdBy: 'u1',
    };
    prisma.retirementSchedule.findFirst.mockResolvedValue(existing);
    prisma.retirementSchedule.update.mockImplementation((args: any) =>
      Promise.resolve({ ...existing, ...args.data }),
    );

    await service.update('c1', 's1', { name: 'New Name' });

    const updateCall = prisma.retirementSchedule.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 's1' });
    expect(updateCall.data.name).toBe('New Name');
    expect(updateCall.data.nextRunDate).toBeUndefined();
  });
});
