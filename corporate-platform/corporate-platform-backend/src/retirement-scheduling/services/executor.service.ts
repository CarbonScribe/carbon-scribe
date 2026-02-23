import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ScheduleService } from './schedule.service';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
  ) {}

  async executeDueSchedules(now: Date = new Date()) {
    const dueSchedules = await this.prisma.retirementSchedule.findMany({
      where: {
        isActive: true,
        nextRunDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: { nextRunDate: 'asc' },
    });

    const retriable = await this.prisma.scheduleExecution.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 },
        nextRetryDate: { lte: now },
      },
      include: { schedule: true },
    });

    const scheduleResults = [];
    for (const schedule of dueSchedules) {
      scheduleResults.push(await this.executeSchedule(schedule.id, false));
    }

    const retryResults = [];
    for (const execution of retriable) {
      retryResults.push(
        await this.executeSchedule(execution.scheduleId, false, execution.id),
      );
    }

    return {
      processedSchedules: scheduleResults.length,
      retriedExecutions: retryResults.length,
      scheduleResults,
      retryResults,
    };
  }

  async executeNow(scheduleId: string) {
    return this.executeSchedule(scheduleId, true);
  }

  private async executeSchedule(
    scheduleId: string,
    isManual: boolean,
    existingExecutionId?: string,
  ) {
    const schedule = await this.prisma.retirementSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return { scheduleId, status: 'failed', error: 'Schedule not found' };
    }

    const execution = existingExecutionId
      ? await this.prisma.scheduleExecution.update({
          where: { id: existingExecutionId },
          data: {
            status: 'processing',
            executedDate: new Date(),
          },
        })
      : await this.prisma.scheduleExecution.create({
          data: {
            scheduleId: schedule.id,
            scheduledDate: schedule.nextRunDate,
            status: 'processing',
            executedDate: new Date(),
          },
        });

    try {
      const result = await this.performRetirement(schedule);

      const completedStatus =
        result.amountRetired === 0
          ? 'failed'
          : result.remainingAmount > 0
            ? 'partial'
            : 'success';

      const executionStatus =
        completedStatus === 'success'
          ? 'completed'
          : completedStatus === 'partial'
            ? 'completed'
            : 'failed';

      await this.prisma.scheduleExecution.update({
        where: { id: execution.id },
        data: {
          status: executionStatus,
          amountRetired: result.amountRetired,
          retirementIds: result.retirementIds,
          errorMessage:
            result.remainingAmount > 0
              ? `Insufficient balance. Remaining amount: ${result.remainingAmount}`
              : null,
          retryCount:
            executionStatus === 'failed' ? { increment: 1 } : undefined,
          nextRetryDate:
            executionStatus === 'failed'
              ? new Date(Date.now() + 60 * 60 * 1000)
              : null,
        },
      });

      const now = new Date();
      if (executionStatus === 'failed') {
        await this.prisma.retirementSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunDate: now,
            lastRunStatus: completedStatus,
          },
        });
      } else {
        const nextRunDate = this.scheduleService.calculateNextRunDate(
          schedule.nextRunDate,
          schedule.frequency,
          schedule.interval,
        );

        await this.prisma.retirementSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunDate: now,
            lastRunStatus: completedStatus,
            runCount: { increment: 1 },
            nextRunDate,
            isActive:
              schedule.frequency === 'one-time' ? false : schedule.isActive,
          },
        });
      }

      if (schedule.notifyAfter) {
        this.logger.log(
          JSON.stringify({
            type: 'retirement-execution',
            channel: ['email', 'in-app'],
            companyId: schedule.companyId,
            createdBy: schedule.createdBy,
            scheduleId: schedule.id,
            status: completedStatus,
            amountRetired: result.amountRetired,
            retirementIds: result.retirementIds,
          }),
        );
      }

      return {
        scheduleId,
        executionId: execution.id,
        status: completedStatus,
        isManual,
        amountRetired: result.amountRetired,
        retirementIds: result.retirementIds,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Execution failed for schedule ${scheduleId}: ${err.message}`,
      );

      await this.prisma.scheduleExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          errorMessage: err.message,
          retryCount: { increment: 1 },
          nextRetryDate: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await this.prisma.retirementSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunDate: new Date(),
          lastRunStatus: 'failed',
        },
      });

      return {
        scheduleId,
        executionId: execution.id,
        status: 'failed',
        isManual,
        error: err.message,
      };
    }
  }

  private async performRetirement(schedule: any) {
    let remaining = schedule.amount;
    const retirementIds: string[] = [];
    let amountRetired = 0;

    const credits = await this.selectCreditsForSchedule(schedule);

    for (const credit of credits) {
      if (remaining <= 0) break;

      const retireAmount = Math.min(remaining, credit.available);
      if (retireAmount <= 0) continue;

      const retirement = await (this.prisma as any).$transaction(
        async (tx: any) => {
          await tx.credit.update({
            where: { id: credit.id },
            data: { available: { decrement: retireAmount } },
          });

          return tx.retirement.create({
            data: {
              companyId: schedule.companyId,
              userId: schedule.createdBy,
              creditId: credit.id,
              amount: retireAmount,
              purpose: schedule.purpose,
              purposeDetails: `Scheduled retirement: ${schedule.name}`,
              priceAtRetirement: 10,
              transactionHash: `tx_${Math.random().toString(36).slice(2, 10)}`,
              transactionUrl: 'https://stellar.expert/explorer/testnet/tx/...',
              verifiedAt: new Date(),
            },
          });
        },
      );

      retirementIds.push(retirement.id);
      amountRetired += retireAmount;
      remaining -= retireAmount;
    }

    return {
      retirementIds,
      amountRetired,
      remainingAmount: remaining,
    };
  }

  private async selectCreditsForSchedule(schedule: any) {
    if (
      schedule.creditSelection === 'specific' &&
      schedule.creditIds.length > 0
    ) {
      return this.prisma.credit.findMany({
        where: {
          id: { in: schedule.creditIds },
          available: { gt: 0 },
        },
        orderBy: { available: 'desc' },
      });
    }

    return this.prisma.credit.findMany({
      where: { available: { gt: 0 } },
      orderBy: { available: 'desc' },
      take: 20,
    });
  }
}
