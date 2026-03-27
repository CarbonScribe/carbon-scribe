import { Module } from '@nestjs/common';
import { OwnershipHistoryService } from './ownership-history.service';
import { EventProcessorService } from './event-processor.service';
import { HistoryQueryService } from './history-query.service';
import { OwnershipHistoryController } from './ownership-history.controller';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [OwnershipHistoryController],
  providers: [
    OwnershipHistoryService,
    EventProcessorService,
    HistoryQueryService,
  ],
  exports: [OwnershipHistoryService],
})
export class OwnershipHistoryModule {}
