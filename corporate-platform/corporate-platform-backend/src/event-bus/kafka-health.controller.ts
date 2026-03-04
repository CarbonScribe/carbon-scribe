import {
  Controller,
  Get,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KafkaService } from './kafka.service';

@Controller('health/kafka')
export class KafkaHealthController {
  private readonly logger = new Logger(KafkaHealthController.name);

  constructor(private readonly kafkaService: KafkaService) {}

  @Get()
  async checkHealth() {
    try {
      const admin = this.kafkaService.getAdmin();
      // Fetch cluster metadata as a liveness check
      const metadata = await admin.fetchTopicMetadata({ topics: [] });

      return {
        status: 'ok',
        brokers: metadata.topics.length >= 0 ? 'connected' : 'unknown',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Kafka health check failed', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Kafka cluster is unreachable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
