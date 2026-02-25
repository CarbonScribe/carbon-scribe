import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { TOPIC_REGISTRY } from './topic-registry';

@Injectable()
export class TopicManager implements OnModuleInit {
  private readonly logger = new Logger(TopicManager.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async onModuleInit() {
    await this.createTopics();
  }

  private async createTopics() {
    const admin = this.kafkaService.getAdmin();
    try {
      const existingTopics = await admin.listTopics();

      const topicsToCreate = Object.values(TOPIC_REGISTRY)
        .filter((topicConfig) => !existingTopics.includes(topicConfig.name))
        .map((topicConfig) => ({
          topic: topicConfig.name,
          numPartitions: topicConfig.numPartitions,
          configEntries: [
            {
              name: 'retention.ms',
              value: topicConfig.retentionMs.toString(),
            },
          ],
        }));

      if (topicsToCreate.length > 0) {
        this.logger.log(`Creating ${topicsToCreate.length} Kafka topics...`);
        const success = await admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true,
        });

        if (success) {
          this.logger.log('Topics created successfully.');
        } else {
          this.logger.warn('Some topics may not have been created properly.');
        }
      } else {
        this.logger.log('All required Kafka topics already exist.');
      }
    } catch (error) {
      this.logger.error('Failed to create Kafka topics', error);
      throw error;
    }
  }
}
