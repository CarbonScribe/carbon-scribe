import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { Event } from '../interfaces/event.interface';
import { ValidationError } from '../event-validator.service';
import { TOPIC_REGISTRY } from '../topics/topic-registry';

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  originalTopic: string;
  event: Event;
  errors: ValidationError[];
  failureReason: string;
  failedAt: string;
  originalEventId: string;
  originalTimestamp: string;
}

/**
 * Dead Letter Queue Service
 *
 * Features:
 * - Routing invalid events to DLQ
 * - Preserving original event metadata
 * - Adding failure context
 * - Structured error information
 */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * Route a raw failed message (e.g. unparseable payload or exhausted
   * consumer retries) to the dead-letter queue.
   */
  async routeToDlq(
    originalTopic: string,
    message: unknown,
    error: Error,
  ): Promise<void> {
    try {
      const producer = this.kafkaService.getProducer();

      const dlqPayload = {
        originalTopic,
        originalMessage: message,
        error: error.message,
        stackTrace: error.stack,
        timestamp: new Date().toISOString(),
      };

      await producer.send({
        topic: TOPIC_REGISTRY.DEAD_LETTER_QUEUE.name,
        messages: [
          {
            value: JSON.stringify(dlqPayload),
          },
        ],
      });

      this.logger.warn(`Message routed to DLQ from topic ${originalTopic}`);
    } catch (dlqError) {
      this.logger.error('Failed to route message to DLQ', dlqError);
      // Don't throw - we don't want to crash the consumer loop if DLQ fails
    }
  }

  /**
   * Send an invalid event to the dead-letter queue
   */
  async sendToDeadLetter(
    originalTopic: string,
    event: Event,
    errors: ValidationError[],
    failureReason: string,
  ): Promise<void> {
    const dlqTopic = TOPIC_REGISTRY.DEAD_LETTER_QUEUE.name;

    const dlqEntry: DeadLetterEntry = {
      originalTopic,
      event,
      errors,
      failureReason,
      failedAt: new Date().toISOString(),
      originalEventId: event.id,
      originalTimestamp: event.timestamp,
    };

    try {
      const producer = this.kafkaService.getProducer();
      await producer.send({
        topic: dlqTopic,
        messages: [
          {
            key: event.companyId || event.userId || event.source || 'dlq',
            value: JSON.stringify(dlqEntry),
          },
        ],
      });

      this.logger.warn(`Event ${event.id} sent to dead-letter queue`, {
        originalTopic,
        failureReason,
        errorCount: errors.length,
        eventType: event.type,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send event to dead-letter queue: ${err.message}`,
        {
          originalTopic,
          eventId: event.id,
          error: err.message,
        },
      );
      // Don't throw - we don't want to fail the publishing flow if DLQ fails
    }
  }

  /**
   * Get dead-letter queue entry count
   */
  async getDeadLetterCount(): Promise<number> {
    try {
      const admin = this.kafkaService.getAdmin();
      const metadata = await admin.fetchTopicMetadata({
        topics: [TOPIC_REGISTRY.DEAD_LETTER_QUEUE.name],
      });
      const topic = metadata.topics.find(
        (t) => t.name === TOPIC_REGISTRY.DEAD_LETTER_QUEUE.name,
      );
      return (
        topic?.partitions.reduce((sum, p) => sum + (p.leader ? 0 : 0), 0) || 0
      );
    } catch {
      return 0;
    }
  }
}
