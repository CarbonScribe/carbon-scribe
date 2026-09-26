import { describe, expect, it } from 'vitest';
import { serializeMetricsToCsv } from './exportUtils';

describe('serializeMetricsToCsv', () => {
  it('exports header and rows for the available metrics', () => {
    const csv = serializeMetricsToCsv([
      {
        id: 'm-1',
        name: 'latency',
        value: 42,
        unit: 'ms',
        timestamp: '2026-07-29T10:00:00Z',
      },
      {
        id: 'm-2',
        name: 'error rate',
        value: 0.2,
        unit: '%',
        timestamp: '2026-07-29T10:05:00Z',
      },
    ] as any);

    expect(csv).toContain('id,name,value,unit,timestamp');
    expect(csv).toContain('m-1,latency,42,ms,2026-07-29T10:00:00Z');
    expect(csv).toContain('m-2,error rate,0.2,%,2026-07-29T10:05:00Z');
  });

  it('returns the header only for an empty metric list', () => {
    const csv = serializeMetricsToCsv([]);

    expect(csv).toBe('id,name,value,unit,timestamp\n');
  });
});
