import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { ReminderService } from './reminder.service';

@Injectable()
export class SchedulingRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulingRunnerService.name);
  private intervalRef?: NodeJS.Timeout;

  constructor(
    private readonly executorService: ExecutorService,
    private readonly reminderService: ReminderService,
  ) {}

  onModuleInit() {
    this.intervalRef = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Scheduling runner failed: ${err.message}`);
      }
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  async runOnce(now: Date = new Date()) {
    const [executorResult, reminderResult] = await Promise.all([
      this.executorService.executeDueSchedules(now),
      this.reminderService.sendDueReminders(now),
    ]);

    return {
      executorResult,
      reminderResult,
    };
  }
}
