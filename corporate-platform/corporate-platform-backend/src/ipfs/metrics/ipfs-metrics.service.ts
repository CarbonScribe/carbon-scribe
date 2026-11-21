import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

export type IpfsOperation = 'upload' | 'pin' | 'unpin' | 'retrieve';

/**
 * #735: structured metrics for IPFS latency, failure, and fallback rates.
 * Every failure path in the IPFS services previously only logged a
 * Logger.warn/error with nothing a dashboard or alert rule could consume.
 * This is additive — existing log statements are unchanged.
 */
@Injectable()
export class IpfsMetricsService {
  readonly registry = new Registry();

  private readonly operationDuration = new Histogram({
    name: 'ipfs_operation_duration_seconds',
    help: 'Duration of IPFS provider calls (upload, pin, unpin, retrieve)',
    labelNames: ['operation'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [this.registry],
  });

  private readonly operationFailures = new Counter({
    name: 'ipfs_operation_failures_total',
    help: 'Count of failed IPFS provider calls, labeled by operation and reason',
    labelNames: ['operation', 'reason'],
    registers: [this.registry],
  });

  private readonly deadLetterEvents = new Counter({
    name: 'ipfs_dead_letter_total',
    help: 'Count of certificate anchoring failures routed to the dead-letter/retry fallback, distinct from ordinary operation failures',
    labelNames: ['reason'],
    registers: [this.registry],
  });

  /** Records a duration (seconds) for a given IPFS operation. */
  observeDuration(operation: IpfsOperation, durationSeconds: number): void {
    this.operationDuration.observe({ operation }, durationSeconds);
  }

  /** Times an operation and records its duration regardless of outcome. */
  async timeOperation<T>(
    operation: IpfsOperation,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = process.hrtime.bigint();
    try {
      return await fn();
    } finally {
      const elapsedNs = process.hrtime.bigint() - start;
      this.observeDuration(operation, Number(elapsedNs) / 1e9);
    }
  }

  /** Increments the labeled failure counter for an IPFS operation. */
  recordFailure(operation: IpfsOperation, reason: string): void {
    this.operationFailures.inc({ operation, reason: reason || 'unknown' });
  }

  /** Increments the dead-letter/retry fallback counter. */
  recordDeadLetter(reason: string): void {
    this.deadLetterEvents.inc({ reason: reason || 'unknown' });
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
