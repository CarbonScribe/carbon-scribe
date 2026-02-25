import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { TOPIC_REGISTRY } from '../topics/topic-registry';

export interface DlqMessage {
  originalTopic: string;
  originalMessage: any;
  error: string;
  stackTrace?: string;
  timestamp: string;
}

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  private readonly dlqTopicName = TOPIC_REGISTRY.DEAD_LETTER_QUEUE.name;

  constructor(private readonly kafkaService: KafkaService) {}

  async routeToDlq(
    originalTopic: string,
    message: any,
    error: Error,
  ): Promise<void> {
    try {
      const producer = this.kafkaService.getProducer();

      const dlqPayload: DlqMessage = {
        originalTopic,
        originalMessage: message,
        error: error.message,
        stackTrace: error.stack,
        timestamp: new Date().toISOString(),
      };

      await producer.send({
        topic: this.dlqTopicName,
        messages: [
          {
            value: JSON.stringify(dlqPayload),
          },
        ],
      });

      this.logger.warn(`Message routed to DLQ from topic ${originalTopic}`);
    } catch (dlqError) {
      this.logger.error('Failed to route message to DLQ', dlqError);
      // We log and ignore so we don't crash the consumer loop
    }
  }
}
