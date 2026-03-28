import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Kafka, Producer, Consumer, Admin, Partitioners } from 'kafkajs';
import { ConfigService } from '../config/config.service';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private admin: Admin;
  private readonly kafkaEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const kafkaConfig = this.configService.getKafkaConfig();
    const hasBrokers = kafkaConfig.brokers.length > 0;
    const onlyLocalBrokers =
      hasBrokers &&
      kafkaConfig.brokers.every((broker) =>
        /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(broker),
      );
    const forceLocalKafka = process.env.KAFKA_FORCE_LOCAL === 'true';

    this.kafkaEnabled =
      hasBrokers &&
      !(
        process.env.NODE_ENV !== 'production' &&
        onlyLocalBrokers &&
        !forceLocalKafka
      );

    if (!this.kafkaEnabled) {
      this.logger.warn(
        'Kafka is disabled (no brokers configured or local-only brokers in non-production without KAFKA_FORCE_LOCAL=true). Event bus features will be unavailable.',
      );
    }

    let sasl: any = undefined;
    if (kafkaConfig.sasl) {
      sasl = {
        mechanism: kafkaConfig.sasl.mechanism,
        username: kafkaConfig.sasl.username,
        password: kafkaConfig.sasl.password,
      };
    }

    this.kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
      ssl: kafkaConfig.ssl,
      sasl: sasl,
      retry: kafkaConfig.retry
        ? {
            initialRetryTime: kafkaConfig.retry.initialRetryTime,
            retries: kafkaConfig.retry.retries,
          }
        : undefined,
    });

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    this.admin = this.kafka.admin();
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    if (!this.kafkaEnabled) {
      return;
    }

    this.logger.log('Connecting to Kafka...');
    try {
      await this.producer.connect();
      await this.admin.connect();
      this.logger.log('Kafka connected successfully.');
    } catch (error) {
      this.logger.error(
        'Kafka connection failed. Continuing startup without active Kafka connectivity.',
        error as Error,
      );
    }
  }

  private async disconnect() {
    if (!this.kafkaEnabled) {
      return;
    }

    this.logger.log('Disconnecting from Kafka...');
    try {
      await this.producer.disconnect();
      await this.admin.disconnect();
      this.logger.log('Kafka disconnected successfully.');
    } catch (error) {
      this.logger.warn(
        `Kafka disconnect encountered an error: ${String(error)}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.kafkaEnabled;
  }

  getProducer(): Producer {
    if (!this.kafkaEnabled) {
      throw new Error('Kafka is disabled: KAFKA_BROKERS is not configured');
    }

    return this.producer;
  }

  getAdmin(): Admin {
    if (!this.kafkaEnabled) {
      throw new Error('Kafka is disabled: KAFKA_BROKERS is not configured');
    }

    return this.admin;
  }

  createConsumer(groupId: string): Consumer {
    if (!this.kafkaEnabled) {
      throw new Error('Kafka is disabled: KAFKA_BROKERS is not configured');
    }

    return this.kafka.consumer({ groupId });
  }
}
