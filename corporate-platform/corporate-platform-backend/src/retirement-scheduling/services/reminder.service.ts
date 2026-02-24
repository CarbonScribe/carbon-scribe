import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendDueReminders(now: Date = new Date()) {
    const schedules = await this.prisma.retirementSchedule.findMany({
      where: {
        isActive: true,
        notifyBefore: { not: null },
      },
      orderBy: { nextRunDate: 'asc' },
    });

    const reminders = [];
    for (const schedule of schedules) {
      if (schedule.notifyBefore == null) continue;

      const expectedReminderDate = new Date(schedule.nextRunDate);
      expectedReminderDate.setDate(
        expectedReminderDate.getDate() - schedule.notifyBefore,
      );

      if (this.isSameDay(expectedReminderDate, now)) {
        const projectedBalance = await this.estimateProjectedBalance(schedule);
        const insufficient = projectedBalance < schedule.amount;

        const reminderPayload = {
          scheduleId: schedule.id,
          companyId: schedule.companyId,
          createdBy: schedule.createdBy,
          type: 'retirement-reminder',
          channel: ['email', 'in-app'],
          message: `Scheduled retirement "${schedule.name}" is due on ${schedule.nextRunDate.toISOString()} for ${schedule.amount} credits (${schedule.purpose}).`,
          insufficientBalance: insufficient,
          projectedBalance,
        };

        this.logger.log(JSON.stringify(reminderPayload));
        reminders.push(reminderPayload);
      }
    }

    return {
      sent: reminders.length,
      reminders,
    };
  }

  isSameDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  private async estimateProjectedBalance(schedule: any) {
    if (
      schedule.creditSelection === 'specific' &&
      schedule.creditIds.length > 0
    ) {
      const credits = await this.prisma.credit.findMany({
        where: { id: { in: schedule.creditIds } },
        select: { available: true },
      });
      return credits.reduce((sum, c) => sum + c.available, 0);
    }

    const aggregate = await this.prisma.credit.aggregate({
      _sum: { available: true },
      where: { available: { gt: 0 } },
    });

    return aggregate._sum.available || 0;
  }
}
