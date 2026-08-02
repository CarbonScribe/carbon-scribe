import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { Event } from './interfaces/event.interface';
import { ConfigService } from '../config/config.service';
import { EventValidatorService } from './event-validator.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';

/**
 * Kafka Producer Service with timeout, retry, and validation support
 *
 * Features:
 * - Configurable send timeout (default: 10000ms)
 * - Connection timeout for broker discovery
 * - Retry with exponential backoff
 * - AbortController support for cancellation
 * - Batch publishing with timeout
 * - Event validation before publishing
 * - Dead-letter queue routing for invalid events
 */
@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);
  private readonly sendTimeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
    private readonly validator: EventValidatorService,
    private readonly deadLetterService: DeadLetterService,
  ) {
    const kafkaConfig = this.configService.getKafkaConfig();
    this.sendTimeout = kafkaConfig?.producerTimeout || 10000;
    this.maxRetries = kafkaConfig?.maxRetries || 3;
    this.retryDelay = kafkaConfig?.retryDelay || 1000;
  }

  /**
   * Publish a single event with validation, timeout and retry
   */
  async publish(
    topic: string,
    event: Event,
    signal?: AbortSignal,
  ): Promise<void> {
    // Validate event before publishing
    const validationResult = this.validator.validate(event, {
      throwOnError: false,
    });

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        ?.map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      this.logger.error(
        `Event validation failed for ${event.id}: ${errorMessages}`,
      );

      // Send invalid event to dead-letter queue
      await this.deadLetterService.sendToDeadLetter(
        topic,
        event,
        validationResult.errors || [],
        'VALIDATION_FAILED',
      );

      throw new Error(`Event validation failed: ${errorMessages}`);
    }

    // Key by companyId or userId to ensure order partitioning
    const key = event.companyId || event.userId || event.source;

    this.logger.debug(
      `Publishing event ${event.id} of type ${event.type} to topic ${topic}`,
    );

    await this.executeWithRetry(async () => {
      const producer = this.kafkaService.getProducer();
      await this.executeWithTimeout(
        producer.send({
          topic,
          messages: [
            {
              key,
              value: JSON.stringify(event),
            },
          ],
        }),
        this.sendTimeout,
        `Kafka send to ${topic}`,
        signal,
      );
    }, `publish event ${event.id} to ${topic}`);

    this.logger.log(
      `Successfully published event ${event.id} to topic ${topic}`,
    );
  }

  /**
   * Publish a batch of events with validation, timeout and retry
   */
  async publishBatch(
    topic: string,
    events: Event[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (!events.length) {
      this.logger.debug('Empty event batch, skipping publish');
      return;
    }

    // Validate all events before publishing
    const validationResults = this.validator.validateBatch(events);
    const invalidEvents: { event: Event; errors: any[] }[] = [];

    for (let i = 0; i < events.length; i++) {
      const result = validationResults[i];
      if (!result.valid) {
        invalidEvents.push({
          event: events[i],
          errors: result.errors || [],
        });
      }
    }

    // Handle invalid events
    if (invalidEvents.length > 0) {
      this.logger.error(
        `Batch validation failed: ${invalidEvents.length} events invalid out of ${events.length}`,
      );

      // Send each invalid event to dead-letter queue
      for (const { event, errors } of invalidEvents) {
        await this.deadLetterService.sendToDeadLetter(
          topic,
          event,
          errors,
          'VALIDATION_FAILED',
        );
      }

      throw new Error(
        `Batch validation failed: ${invalidEvents.length} events invalid. ` +
          `First error: ${invalidEvents[0].errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
      );
    }

    const messages = events.map((event) => ({
      key: event.companyId || event.userId || event.source,
      value: JSON.stringify(event),
    }));

    this.logger.debug(
      `Publishing batch of ${events.length} events to topic ${topic}`,
    );

    await this.executeWithRetry(async () => {
      const producer = this.kafkaService.getProducer();
      await this.executeWithTimeout(
        producer.send({
          topic,
          messages,
        }),
        this.sendTimeout,
        `Kafka batch send to ${topic}`,
        signal,
      );
    }, `publish batch of ${events.length} events to ${topic}`);

    this.logger.log(
      `Successfully published batch of ${events.length} events to topic ${topic}`,
    );
  }

  /**
   * Publish event without validation (for internal use)
   */
  async publishInternal(
    topic: string,
    event: Event,
    signal?: AbortSignal,
  ): Promise<void> {
    const key = event.companyId || event.userId || event.source;

    this.logger.debug(
      `Publishing internal event ${event.id} of type ${event.type} to topic ${topic}`,
    );

    await this.executeWithRetry(async () => {
      const producer = this.kafkaService.getProducer();
      await this.executeWithTimeout(
        producer.send({
          topic,
          messages: [
            {
              key,
              value: JSON.stringify(event),
            },
          ],
        }),
        this.sendTimeout,
        `Kafka send to ${topic}`,
        signal,
      );
    }, `publish internal event ${event.id} to ${topic}`);

    this.logger.log(
      `Successfully published internal event ${event.id} to topic ${topic}`,
    );
  }

  /**
   * Execute an operation with retry and exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const err = error as Error;
        lastError = err;

        // Don't retry on certain errors
        if (this.isNonRetryableError(err)) {
          this.logger.error(
            `Non-retryable error in ${operationName}: ${err.message}`,
          );
          throw err;
        }

        if (attempt === this.maxRetries) {
          this.logger.error(
            `Failed ${operationName} after ${this.maxRetries} attempts`,
          );
          throw err;
        }

        const delay = Math.min(
          this.retryDelay * Math.pow(2, attempt - 1),
          30000,
        );
        this.logger.warn(
          `Retry ${attempt}/${this.maxRetries} for ${operationName} in ${delay}ms: ${err.message}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`Failed ${operationName} after retries`);
  }

  /**
   * Execute an operation with timeout and cancellation support
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeoutId);
            reject(new Error(`${operationName} cancelled`));
          },
          { once: true },
        );
      }
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Check if an error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableMessages = [
      'Topic authorization failed',
      'Invalid topic',
      'Message too large',
      'Invalid partition',
      'Not enough replicas',
    ];

    return nonRetryableMessages.some((msg) => error.message.includes(msg));
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
