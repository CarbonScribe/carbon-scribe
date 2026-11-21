import { IpfsMetricsService } from './ipfs-metrics.service';

describe('IpfsMetricsService (#735)', () => {
  let metrics: IpfsMetricsService;

  beforeEach(() => {
    metrics = new IpfsMetricsService();
  });

  it('records a duration histogram sample for an operation', async () => {
    await metrics.timeOperation('upload', () => Promise.resolve('ok'));

    const text = await metrics.getMetricsText();
    expect(text).toContain('ipfs_operation_duration_seconds');
    expect(text).toContain('operation="upload"');
  });

  it('records the result even when the operation throws, and rethrows', async () => {
    await expect(
      metrics.timeOperation('pin', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    const text = await metrics.getMetricsText();
    expect(text).toContain('operation="pin"');
  });

  it('increments a labeled failure counter by operation and reason', async () => {
    metrics.recordFailure('retrieve', 'not-retrievable');

    const text = await metrics.getMetricsText();
    expect(text).toContain('ipfs_operation_failures_total');
    expect(text).toContain('operation="retrieve"');
    expect(text).toContain('reason="not-retrievable"');
  });

  it('increments a dedicated dead-letter/fallback counter, distinguishable from ordinary failures', async () => {
    metrics.recordDeadLetter('certificate-anchor-failed');

    const text = await metrics.getMetricsText();
    expect(text).toContain('ipfs_dead_letter_total');
    expect(text).toContain('reason="certificate-anchor-failed"');
  });

  it('exposes the Prometheus-standard content type', () => {
    expect(metrics.contentType).toMatch(/^text\/plain/);
  });
});
