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

  constructor(private readonly configService: ConfigService) {
    const kafkaConfig = this.configService.getKafkaConfig();

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
    this.logger.log('Connecting to Kafka...');
    await this.producer.connect();
    await this.admin.connect();
    this.logger.log('Kafka connected successfully.');
  }

  private async disconnect() {
    this.logger.log('Disconnecting from Kafka...');
    await this.producer.disconnect();
    await this.admin.disconnect();
    this.logger.log('Kafka disconnected successfully.');
  }

  getProducer(): Producer {
    return this.producer;
  }

  getAdmin(): Admin {
    return this.admin;
  }

  createConsumer(groupId: string): Consumer {
    return this.kafka.consumer({ groupId });
  }
}
