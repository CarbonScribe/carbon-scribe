import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { TopicManager } from './topics/topic-manager';
import { ProducerService } from './producer.service';
import { ConsumerService } from './consumer.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';
import { KafkaHealthController } from './kafka-health.controller';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [KafkaHealthController],
  providers: [
    KafkaService,
    TopicManager,
    ProducerService,
    ConsumerService,
    DeadLetterService,
  ],
  exports: [KafkaService, ProducerService, ConsumerService],
})
export class EventBusModule {}
