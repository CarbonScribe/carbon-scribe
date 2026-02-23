import { Injectable } from '@nestjs/common';
import { BatchRetirementDto } from './dto/batch-retirement.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { BatchService } from './services/batch.service';
import { ExecutorService } from './services/executor.service';
import { ReminderService } from './services/reminder.service';
import { ScheduleService } from './services/schedule.service';
import { SchedulingRunnerService } from './services/scheduling-runner.service';

@Injectable()
export class SchedulingService {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly executorService: ExecutorService,
    private readonly reminderService: ReminderService,
    private readonly batchService: BatchService,
    private readonly runnerService: SchedulingRunnerService,
  ) {}

  createSchedule(companyId: string, userId: string, dto: CreateScheduleDto) {
    return this.scheduleService.create(companyId, userId, dto);
  }

  listSchedules(companyId: string) {
    return this.scheduleService.list(companyId);
  }

  getSchedule(companyId: string, id: string) {
    return this.scheduleService.getById(companyId, id);
  }

  updateSchedule(companyId: string, id: string, dto: UpdateScheduleDto) {
    return this.scheduleService.update(companyId, id, dto);
  }

  deleteSchedule(companyId: string, id: string) {
    return this.scheduleService.remove(companyId, id);
  }

  pauseSchedule(companyId: string, id: string) {
    return this.scheduleService.pause(companyId, id);
  }

  resumeSchedule(companyId: string, id: string) {
    return this.scheduleService.resume(companyId, id);
  }

  async executeScheduleNow(companyId: string, id: string) {
    await this.scheduleService.getById(companyId, id);
    return this.executorService.executeNow(id);
  }

  listExecutions(companyId: string, id: string) {
    return this.scheduleService.getExecutions(companyId, id);
  }

  createBatch(companyId: string, userId: string, dto: BatchRetirementDto) {
    return this.batchService.createBatch(companyId, userId, dto, true);
  }

  listBatches(companyId: string) {
    return this.batchService.listBatches(companyId);
  }

  getBatch(companyId: string, id: string) {
    return this.batchService.getBatch(companyId, id);
  }

  createBatchFromCsv(
    companyId: string,
    userId: string,
    name: string,
    description: string | undefined,
    csvContent: string,
  ) {
    return this.batchService.createBatchFromCsv(
      companyId,
      userId,
      name,
      description,
      csvContent,
      true,
    );
  }

  runBackgroundCycle(now: Date = new Date()) {
    return this.runnerService.runOnce(now);
  }

  sendReminders(now: Date = new Date()) {
    return this.reminderService.sendDueReminders(now);
  }
}
