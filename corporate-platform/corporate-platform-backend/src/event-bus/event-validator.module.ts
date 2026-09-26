import { Module, Global } from '@nestjs/common';
import { EventValidatorService } from './event-validator.service';

@Global()
@Module({
  providers: [EventValidatorService],
  exports: [EventValidatorService],
})
export class EventValidatorModule {}
