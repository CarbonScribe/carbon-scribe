import { Test, TestingModule } from '@nestjs/testing';
import { SchedulingService } from './scheduling.service';
import { ScheduleService } from './services/schedule.service';
import { ExecutorService } from './services/executor.service';
import { ReminderService } from './services/reminder.service';
import { BatchService } from './services/batch.service';
import { SchedulingRunnerService } from './services/scheduling-runner.service';

describe('SchedulingService', () => {
  let service: SchedulingService;
  let scheduleService: ScheduleService;
  let executorService: ExecutorService;
  let batchService: BatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingService,
        {
          provide: ScheduleService,
          useValue: {
            create: jest.fn(),
            list: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            pause: jest.fn(),
            resume: jest.fn(),
            getExecutions: jest.fn(),
          },
        },
        {
          provide: ExecutorService,
          useValue: { executeNow: jest.fn() },
        },
        {
          provide: ReminderService,
          useValue: { sendDueReminders: jest.fn() },
        },
        {
          provide: BatchService,
          useValue: {
            createBatch: jest.fn(),
            createBatchFromCsv: jest.fn(),
            listBatches: jest.fn(),
            getBatch: jest.fn(),
          },
        },
        {
          provide: SchedulingRunnerService,
          useValue: { runOnce: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SchedulingService>(SchedulingService);
    scheduleService = module.get<ScheduleService>(ScheduleService);
    executorService = module.get<ExecutorService>(ExecutorService);
    batchService = module.get<BatchService>(BatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createSchedule delegates to scheduleService.create', async () => {
    const dto = {
      name: 'Test',
      purpose: 'scope1',
      amount: 10,
      creditSelection: 'automatic' as const,
      frequency: 'monthly' as const,
      startDate: '2026-01-01',
    };
    (scheduleService.create as jest.Mock).mockResolvedValue({ id: 's1' });
    await service.createSchedule('c1', 'u1', dto);
    expect(scheduleService.create).toHaveBeenCalledWith('c1', 'u1', dto);
  });

  it('executeScheduleNow validates company access then runs executor', async () => {
    (scheduleService.getById as jest.Mock).mockResolvedValue({ id: 's1' });
    (executorService.executeNow as jest.Mock).mockResolvedValue({ status: 'success' });
    const result = await service.executeScheduleNow('c1', 's1');
    expect(scheduleService.getById).toHaveBeenCalledWith('c1', 's1');
    expect(executorService.executeNow).toHaveBeenCalledWith('s1');
    expect(result).toEqual({ status: 'success' });
  });

  it('createBatch delegates to batchService with autoProcess true', async () => {
    const dto = { name: 'B1', items: [{ creditId: 'cr1', amount: 5, purpose: 'scope1' }] };
    (batchService.createBatch as jest.Mock).mockResolvedValue({ id: 'b1' });
    await service.createBatch('c1', 'u1', dto);
    expect(batchService.createBatch).toHaveBeenCalledWith('c1', 'u1', dto, true);
  });
});
