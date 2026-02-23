import { ReminderService } from './reminder.service';

describe('ReminderService', () => {
  let service: ReminderService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      retirementSchedule: { findMany: jest.fn() },
      credit: { aggregate: jest.fn(), findMany: jest.fn() },
    };
    service = new ReminderService(prisma);
  });

  it('triggers reminder at exact lead time day', async () => {
    prisma.retirementSchedule.findMany.mockResolvedValue([
      {
        id: 's1',
        companyId: 'c1',
        createdBy: 'u1',
        notifyBefore: 3,
        nextRunDate: new Date('2026-03-01T00:00:00.000Z'),
        amount: 100,
        purpose: 'scope1',
        name: 'Monthly Scope 1 Offset',
        creditSelection: 'automatic',
        creditIds: [],
      },
    ]);
    prisma.credit.aggregate.mockResolvedValue({ _sum: { available: 200 } });

    const result = await service.sendDueReminders(
      new Date('2026-02-26T10:00:00.000Z'),
    );

    expect(result.sent).toBe(1);
    expect(result.reminders[0].scheduleId).toBe('s1');
  });
});
