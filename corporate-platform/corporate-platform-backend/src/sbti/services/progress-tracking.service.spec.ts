import { ProgressTrackingService } from './progress-tracking.service';

describe('ProgressTrackingService (#546)', () => {
  const service = new ProgressTrackingService();
  const target = {
    id: 't1',
    scope: '1',
    status: 'VALIDATED',
    baseYear: 2020,
    baseYearEmissions: 1000,
    targetYear: 2030,
    reductionPercentage: 50,
  };

  it('marks on_track when actual matches linear trajectory', () => {
    // Midpoint 2025 → expected 750
    const status = service.classifyTrackStatus(target, 2025, 750);
    expect(status).toBe('on_track');
  });

  it('marks behind when actual is above trajectory', () => {
    expect(service.classifyTrackStatus(target, 2025, 950)).toBe('behind');
  });

  it('marks ahead when actual is below trajectory', () => {
    expect(service.classifyTrackStatus(target, 2025, 500)).toBe('ahead');
  });

  it('returns unknown for missing actuals', () => {
    expect(service.classifyTrackStatus(target, 2025, null)).toBe('unknown');
  });

  it('computes completion percentage toward reduction goal', () => {
    // 25% of the 50% cut done → 50% complete
    expect(service.completionPercentage(target, 875)).toBeCloseTo(25, 5);
    expect(service.completionPercentage(target, 500)).toBeCloseTo(100, 5);
    expect(service.completionPercentage(target, null)).toBe(0);
  });

  it('aggregates summary, series, and scope rollups', () => {
    const dash = service.aggregate(
      [target, { ...target, id: 't2', scope: '2', status: 'DRAFT' }],
      [
        { targetId: 't1', reportingYear: 2024, emissions: 800 },
        { targetId: 't2', reportingYear: 2024, emissions: 400 },
      ],
    );
    expect(dash.summary.totalTargets).toBe(2);
    expect(dash.summary.byStatus.VALIDATED).toBe(1);
    expect(dash.summary.byStatus.DRAFT).toBe(1);
    expect(dash.targets[0].series.length).toBeGreaterThan(0);
    expect(dash.scopeRollups.length).toBe(2);
  });
});
