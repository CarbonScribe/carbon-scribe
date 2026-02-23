import { ExecutorService } from './executor.service';

describe('ExecutorService', () => {
  let service: ExecutorService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      retirementSchedule: { findMany: jest.fn() },
      scheduleExecution: { findMany: jest.fn() },
    };
    service = new ExecutorService(prisma, {} as any);
  });

  it('identifies and executes only due schedules', async () => {
    prisma.retirementSchedule.findMany.mockResolvedValue([
      { id: 'sched_due_1' },
      { id: 'sched_due_2' },
    ]);
    prisma.scheduleExecution.findMany.mockResolvedValue([]);

    const executeSpy = jest
      .spyOn(service as any, 'executeSchedule')
      .mockResolvedValue({ status: 'success' });

    const now = new Date('2026-02-23T12:00:00.000Z');
    const result = await service.executeDueSchedules(now);

    expect(prisma.retirementSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          nextRunDate: { lte: now },
        }),
      }),
    );
    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(result.processedSchedules).toBe(2);
  });
});
