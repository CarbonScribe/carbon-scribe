import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { TopicManager } from './topics/topic-manager';
import { ProducerService } from './producer.service';
import { ConsumerService } from './consumer.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';
import { KafkaHealthController } from './kafka-health.controller';
import { CacheModule } from '../cache/cache.module';
import { EventValidatorService } from './event-validator.service';
import { EventValidatorModule } from './event-validator.module';

@Module({
  imports: [CacheModule, EventValidatorModule],
  controllers: [KafkaHealthController],
  providers: [
    KafkaService,
    TopicManager,
    ProducerService,
    ConsumerService,
    DeadLetterService,
    EventValidatorService,
  ],
  exports: [
    KafkaService,
    ProducerService,
    ConsumerService,
    EventValidatorService,
    DeadLetterService,
  ],
})
export class EventBusModule {}
