import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../shared/database/prisma.service';
import { KafkaService } from './kafka.service';

export type OutboxStatus = 'pending' | 'published' | 'failed';

export interface OutboxCreateInput {
  topic: string;
  payload: unknown;
  key: string;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly maxAttempts: number;
  private readonly sendTimeout: number;
  private readonly kafkaRetries: number;
  private readonly retryDelay: number;
  private readonly batchSize = 50;
  private readonly metrics = { created: 0, published: 0, failed: 0 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {
    this.maxAttempts = this.configService.get<number>(
      'OUTBOX_MAX_ATTEMPTS',
      10,
    );
    this.sendTimeout = this.configService.get<number>(
      'KAFKA_PRODUCER_TIMEOUT',
      10000,
    );
    this.kafkaRetries = this.configService.get<number>('KAFKA_MAX_RETRIES', 3);
    this.retryDelay = this.configService.get<number>('KAFKA_RETRY_DELAY', 1000);
  }

  async create(input: OutboxCreateInput, tx?: any): Promise<any> {
    const client = tx || this.prisma;
    try {
      const row = await client.outboxEvent.create({
        data: { topic: input.topic, payload: input.payload, key: input.key },
      });
      this.metrics.created += 1;
      return row;
    } catch (error) {
      if ((error as any)?.code !== 'P2002') throw error;
      return client.outboxEvent.findUnique({
        where: { topic_key: { topic: input.topic, key: input.key } },
      });
    }
  }

  async createMany(inputs: OutboxCreateInput[], tx?: any): Promise<any[]> {
    if (tx) {
      return Promise.all(inputs.map((input) => this.create(input, tx)));
    }
    return this.prisma.$transaction(async (transaction) =>
      Promise.all(inputs.map((input) => this.create(input, transaction))),
    );
  }

  async publish(rowId: string, signal?: AbortSignal): Promise<boolean> {
    const row = await (this.prisma as any).outboxEvent.findUnique({
      where: { id: rowId },
    });
    if (!row || row.status !== 'pending') return row?.status === 'published';

    if (!this.kafkaService.isEnabled()) {
      this.logger.warn(
        `Kafka disabled; leaving outbox event ${row.id} pending`,
      );
      return false;
    }

    await this.incrementAttempts(row.id);
    try {
      await this.sendWithRetry(row, signal);
      await (this.prisma as any).outboxEvent.update({
        where: { id: row.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      this.metrics.published += 1;
      return true;
    } catch (error) {
      await (this.prisma as any).outboxEvent.update({
        where: { id: row.id },
        data: {
          nextAttemptAt: new Date(Date.now() + this.backoff(row.attempts)),
        },
      });
      await this.markFailureIfExhausted(row.id);
      this.logger.error(`Outbox event ${row.id} could not be published`, error);
      return false;
    }
  }

  async publishByKey(
    topic: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const row = await (this.prisma as any).outboxEvent.findUnique({
      where: { topic_key: { topic, key } },
    });
    return row ? this.publish(row.id, signal) : false;
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async relayPending(): Promise<void> {
    const rows = await (this.prisma as any).outboxEvent.findMany({
      where: {
        status: 'pending',
        attempts: { lt: this.maxAttempts },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });

    for (const row of rows) {
      const published = await this.publish(row.id);
      if (!published) break;
    }
  }

  async replayFailed(id?: string): Promise<number> {
    const result = id
      ? await (this.prisma as any).outboxEvent.updateMany({
          where: { id, status: 'failed' },
          data: { status: 'pending', attempts: 0 },
        })
      : await (this.prisma as any).outboxEvent.updateMany({
          where: { status: 'failed' },
          data: { status: 'pending', attempts: 0 },
        });
    return result.count;
  }

  async inspect(status?: OutboxStatus): Promise<any[]> {
    return (this.prisma as any).outboxEvent.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getMetrics() {
    const [pending, failed] = await Promise.all([
      (this.prisma as any).outboxEvent.count({ where: { status: 'pending' } }),
      (this.prisma as any).outboxEvent.count({ where: { status: 'failed' } }),
    ]);
    return { ...this.metrics, pending, failed };
  }

  private async incrementAttempts(id: string): Promise<void> {
    await (this.prisma as any).outboxEvent.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  private async sendWithRetry(row: any, signal?: AbortSignal): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.kafkaRetries; attempt += 1) {
      try {
        const send = this.kafkaService.getProducer().send({
          topic: row.topic,
          messages: [{ key: row.key, value: JSON.stringify(row.payload) }],
        });
        await this.withTimeout(send, this.sendTimeout, signal);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < this.kafkaRetries) {
          await this.sleep(
            Math.min(this.retryDelay * 2 ** (attempt - 1), 30000),
          );
        }
      }
    }
    throw lastError;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    let timeout: NodeJS.Timeout;
    let abortHandler: (() => void) | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Kafka send timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error('Kafka send cancelled'));
      };
      signal?.addEventListener('abort', abortHandler, { once: true });
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeout!);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  private async markFailureIfExhausted(id: string): Promise<void> {
    const row = await (this.prisma as any).outboxEvent.findUnique({
      where: { id },
    });
    if (row?.attempts >= this.maxAttempts) {
      await (this.prisma as any).outboxEvent.update({
        where: { id },
        data: { status: 'failed', nextAttemptAt: null },
      });
      this.metrics.failed += 1;
    }
  }

  private backoff(attempts: number): number {
    const base = this.configService.get<number>('OUTBOX_RETRY_DELAY_MS', 1000);
    return Math.min(base * Math.pow(2, attempts), 30000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
