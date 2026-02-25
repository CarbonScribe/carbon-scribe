import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/database/database.module';
import { RetirementModule } from '../retirement/retirement.module';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { BatchService } from './services/batch.service';
import { ExecutorService } from './services/executor.service';
import { ReminderService } from './services/reminder.service';
import { ScheduleService } from './services/schedule.service';
import { SchedulingRunnerService } from './services/scheduling-runner.service';

@Module({
  imports: [DatabaseModule, RetirementModule],
  controllers: [SchedulingController],
  providers: [
    SchedulingService,
    ScheduleService,
    ExecutorService,
    ReminderService,
    BatchService,
    SchedulingRunnerService,
  ],
  exports: [SchedulingService],
})
export class SchedulingModule {}
