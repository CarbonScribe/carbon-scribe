import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { KafkaService } from './kafka.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';
import { CacheService } from '../cache/cache.service';
import { Event } from './interfaces/event.interface';

@Injectable()
export class ConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly consumers: Consumer[] = [];

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly dlqService: DeadLetterService,
    private readonly cacheService: CacheService,
  ) {}

  async consume(
    groupId: string,
    topic: string | string[],
    messageHandler: (event: Event) => Promise<void>,
    maxRetries = 3,
  ): Promise<void> {
    const consumer = this.kafkaService.createConsumer(groupId);
    this.consumers.push(consumer);

    await consumer.connect();

    const topics = Array.isArray(topic) ? topic : [topic];
    for (const t of topics) {
      // Setup subscription hook
      await consumer.subscribe({ topic: t, fromBeginning: false });
    }

    await consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        let event: Event;

        try {
          const valueString = message.value?.toString();
          if (!valueString) throw new Error('Empty message value');
          event = JSON.parse(valueString) as Event;
        } catch (error) {
          this.logger.error(
            `Failed to parse message from topic ${topic}`,
            error,
          );
          await this.dlqService.routeToDlq(
            topic,
            message.value?.toString() || 'empty',
            error,
          );
          await this.commitOffset(consumer, topic, partition, message.offset);
          return;
        }

        const idempotencyKey = `event_bus:processed:${event.id}`;

        // Deduplicate using CacheService (Redis)
        const alreadyProcessed =
          await this.cacheService.get<boolean>(idempotencyKey);
        if (alreadyProcessed) {
          this.logger.debug(`Event ${event.id} already processed. Skipping.`);
          await this.commitOffset(consumer, topic, partition, message.offset);
          return;
        }

        let retries = 0;
        let success = false;

        while (retries <= maxRetries && !success) {
          try {
            await messageHandler(event);

            // Mark as processed (store for 24 hours to prevent duplicate replays)
            await this.cacheService.set(idempotencyKey, true, 86400);

            await this.commitOffset(consumer, topic, partition, message.offset);
            success = true;
          } catch (error) {
            retries++;
            this.logger.warn(
              `Failed to process event ${event.id}. Attempt ${retries} of ${maxRetries + 1}`,
            );

            if (retries > maxRetries) {
              this.logger.error(
                `Exceeded max retries for event ${event.id}. Routing to DLQ.`,
              );
              await this.dlqService.routeToDlq(topic, event, error);
              // Commit the offset so we don't block the partition indefinitely
              await this.commitOffset(
                consumer,
                topic,
                partition,
                message.offset,
              );
            } else {
              // Backoff pause
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * Math.pow(2, retries)),
              );
              await heartbeat();
            }
          }
        }
      },
    });
  }

  private async commitOffset(
    consumer: Consumer,
    topic: string,
    partition: number,
    offset: string,
  ) {
    await consumer.commitOffsets([
      { topic, partition, offset: (BigInt(offset) + BigInt(1)).toString() },
    ]);
  }

  async onModuleDestroy() {
    for (const consumer of this.consumers) {
      try {
        await consumer.disconnect();
      } catch (err) {
        this.logger.warn(`Failed to disconnect consumer gracefully`, err);
      }
    }
  }
}
