import { ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(() => {
    service = new ScheduleService({} as any);
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
});
