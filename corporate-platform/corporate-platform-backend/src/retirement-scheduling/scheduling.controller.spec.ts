import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('SchedulingController', () => {
  let controller: SchedulingController;
  let schedulingService: SchedulingService;

  const mockUser: JwtPayload = {
    sub: 'user-id',
    email: 'user@example.com',
    companyId: 'company-id',
    role: 'admin',
    sessionId: 'session-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulingController],
      providers: [
        {
          provide: SchedulingService,
          useValue: {
            createSchedule: jest.fn(),
            listSchedules: jest.fn(),
            getSchedule: jest.fn(),
            updateSchedule: jest.fn(),
            deleteSchedule: jest.fn(),
            pauseSchedule: jest.fn(),
            resumeSchedule: jest.fn(),
            executeScheduleNow: jest.fn(),
            listExecutions: jest.fn(),
            createBatch: jest.fn(),
            createBatchFromCsv: jest.fn(),
            listBatches: jest.fn(),
            getBatch: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SchedulingController>(SchedulingController);
    schedulingService = module.get<SchedulingService>(SchedulingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createSchedule calls service with company and user', async () => {
    const dto = {
      name: 'Monthly',
      purpose: 'scope1',
      amount: 100,
      creditSelection: 'automatic' as const,
      frequency: 'monthly' as const,
      startDate: '2026-01-01',
    };
    (schedulingService.createSchedule as jest.Mock).mockResolvedValue({ id: 's1' });
    await controller.createSchedule(mockUser, dto as any);
    expect(schedulingService.createSchedule).toHaveBeenCalledWith(
      mockUser.companyId,
      mockUser.sub,
      dto,
    );
  });

  it('createBatchFromCsv throws when file is missing', async () => {
    await expect(
      controller.createBatchFromCsv(mockUser, undefined, 'Batch', undefined),
    ).rejects.toThrow(BadRequestException);
  });

  it('createBatchFromCsv calls service when file has buffer', async () => {
    const file = { buffer: Buffer.from('creditId,amount,purpose\nc1,10,scope1') };
    (schedulingService.createBatchFromCsv as jest.Mock).mockResolvedValue({ id: 'b1' });
    await controller.createBatchFromCsv(
      mockUser,
      file as any,
      'Batch',
      'desc',
    );
    expect(schedulingService.createBatchFromCsv).toHaveBeenCalledWith(
      mockUser.companyId,
      mockUser.sub,
      'Batch',
      'desc',
      'creditId,amount,purpose\nc1,10,scope1',
    );
  });
});
