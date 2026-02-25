import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { Event } from './interfaces/event.interface';

@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async publish(topic: string, event: Event): Promise<void> {
    const producer = this.kafkaService.getProducer();

    // Key by companyId or userId to ensure order partitioning
    const key = event.companyId || event.userId || event.source;

    try {
      this.logger.debug(
        `Publishing event ${event.id} of type ${event.type} to topic ${topic}`,
      );
      await producer.send({
        topic,
        messages: [
          {
            key,
            value: JSON.stringify(event),
          },
        ],
      });
      this.logger.log(
        `Successfully published event ${event.id} to topic ${topic}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.id} to topic ${topic}`,
        error,
      );
      throw error;
    }
  }

  async publishBatch(topic: string, events: Event[]): Promise<void> {
    if (!events.length) return;

    const producer = this.kafkaService.getProducer();

    const messages = events.map((event) => ({
      key: event.companyId || event.userId || event.source,
      value: JSON.stringify(event),
    }));

    try {
      this.logger.debug(
        `Publishing batch of ${events.length} events to topic ${topic}`,
      );
      await producer.send({
        topic,
        messages,
      });
      this.logger.log(
        `Successfully published batch of ${events.length} events to topic ${topic}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish batch to topic ${topic}`, error);
      throw error;
    }
  }
}
