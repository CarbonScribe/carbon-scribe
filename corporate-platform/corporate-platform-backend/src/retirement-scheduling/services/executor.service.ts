import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { hostname } from 'os';
import { PrismaService } from '../../shared/database/prisma.service';
import { ScheduleService } from './schedule.service';

/** Default execution lease; must exceed the longest expected single run. */
export const DEFAULT_SCHEDULE_LEASE_MS = 15 * 60 * 1000;

const unlocked = (now: Date) => ({
  OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
});

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  /** Identifies this process in `lockedBy` for operability/debugging. */
  readonly instanceId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  private readonly leaseMs =
    Number(process.env.SCHEDULE_CLAIM_LEASE_MS) || DEFAULT_SCHEDULE_LEASE_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
  ) {}

  /**
   * Run every due schedule and every due retry **exactly once across all
   * instances** (#814). Each row is claimed with a conditional `updateMany`
   * that only succeeds while the row is still due and its lease is free (or
   * expired); a claim that matches 0 rows means another instance owns it, so
   * it is skipped. Leases expire on their own if an instance crashes, which
   * makes the row reclaimable on a later tick.
   */
  async executeDueSchedules(now: Date = new Date()) {
    const prisma = this.prisma as any;

    const dueSchedules = (await prisma.retirementSchedule.findMany({
      where: {
        isActive: true,
        nextRunDate: { lte: now },
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          unlocked(now),
        ],
      },
      orderBy: { nextRunDate: 'asc' },
    } as any)) as any[];

    const retriable = (await prisma.scheduleExecution.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 },
        nextRetryDate: { lte: now },
        ...unlocked(now),
      },
      include: { schedule: true },
    } as any)) as any[];

    const scheduleResults = [];
    let skippedClaims = 0;
    for (const schedule of dueSchedules) {
      if (!(await this.claimSchedule(schedule.id, now, true))) {
        skippedClaims += 1;
        continue;
      }
      scheduleResults.push(await this.executeSchedule(schedule.id, false));
    }

    const retryResults = [];
    for (const execution of retriable) {
      if (!(await this.claimRetry(execution.id, now))) {
        skippedClaims += 1;
        continue;
      }
      // The schedule itself must not run concurrently with its retry.
      if (!(await this.claimSchedule(execution.scheduleId, now, false))) {
        await this.releaseRetry(execution.id);
        skippedClaims += 1;
        continue;
      }
      retryResults.push(
        await this.executeSchedule(execution.scheduleId, false, execution.id),
      );
    }

    return {
      processedSchedules: scheduleResults.length,
      retriedExecutions: retryResults.length,
      skippedClaims,
      scheduleResults,
      retryResults,
    };
  }

  async executeNow(scheduleId: string) {
    const now = new Date();
    if (!(await this.claimSchedule(scheduleId, now, false))) {
      return {
        scheduleId,
        status: 'failed',
        isManual: true,
        error: 'Schedule is already being executed by another runner',
      };
    }
    return this.executeSchedule(scheduleId, true);
  }

  /**
   * Atomically take the execution lease on a schedule. With `requireDue`, the
   * claim also re-checks that the schedule is still active and due, so a run
   * that another instance already completed (advancing `nextRunDate`) is
   * never repeated.
   */
  private async claimSchedule(
    scheduleId: string,
    now: Date,
    requireDue: boolean,
  ): Promise<boolean> {
    const prisma = this.prisma as any;
    const { count } = await prisma.retirementSchedule.updateMany({
      where: {
        id: scheduleId,
        ...(requireDue ? { isActive: true, nextRunDate: { lte: now } } : {}),
        ...unlocked(now),
      },
      data: {
        lockedUntil: new Date(now.getTime() + this.leaseMs),
        lockedBy: this.instanceId,
      },
    });
    return count === 1;
  }

  /** Atomically take the lease on a failed execution that is due a retry. */
  private async claimRetry(executionId: string, now: Date): Promise<boolean> {
    const prisma = this.prisma as any;
    const { count } = await prisma.scheduleExecution.updateMany({
      where: {
        id: executionId,
        status: 'failed',
        retryCount: { lt: 3 },
        nextRetryDate: { lte: now },
        ...unlocked(now),
      },
      data: {
        lockedUntil: new Date(now.getTime() + this.leaseMs),
        lockedBy: this.instanceId,
      },
    });
    return count === 1;
  }

  private async releaseRetry(executionId: string): Promise<void> {
    await (this.prisma as any).scheduleExecution.updateMany({
      where: { id: executionId, lockedBy: this.instanceId },
      data: { lockedUntil: null, lockedBy: null },
    });
  }

  private async executeSchedule(
    scheduleId: string,
    isManual: boolean,
    existingExecutionId?: string,
  ) {
    const prisma = this.prisma as any;

    const schedule = (await prisma.retirementSchedule.findUnique({
      where: { id: scheduleId },
    })) as any;

    if (!schedule) {
      return { scheduleId, status: 'failed', error: 'Schedule not found' };
    }

    const execution = existingExecutionId
      ? await prisma.scheduleExecution.update({
          where: { id: existingExecutionId },
          data: {
            status: 'processing',
            executedDate: new Date(),
          } as any,
        })
      : await prisma.scheduleExecution.create({
          data: {
            scheduleId: schedule.id,
            scheduledDate: schedule.nextRunDate,
            status: 'processing',
            executedDate: new Date(),
          } as any,
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

      const now = new Date();
      const executionUpdate = prisma.scheduleExecution.update({
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
          lockedUntil: null,
          lockedBy: null,
        } as any,
      });

      const scheduleUpdate =
        executionStatus === 'failed'
          ? prisma.retirementSchedule.update({
              where: { id: schedule.id },
              data: {
                lastRunDate: now,
                lastRunStatus: completedStatus,
                lockedUntil: null,
                lockedBy: null,
              } as any,
            })
          : prisma.retirementSchedule.update({
              where: { id: schedule.id },
              data: {
                lastRunDate: now,
                lastRunStatus: completedStatus,
                runCount: { increment: 1 },
                nextRunDate: this.scheduleService.calculateNextRunDate(
                  schedule.nextRunDate,
                  schedule.frequency,
                  schedule.interval,
                ),
                isActive:
                  schedule.frequency === 'one-time' ? false : schedule.isActive,
                lockedUntil: null,
                lockedBy: null,
              } as any,
            });

      // The execution record, the nextRunDate advance and the lease release
      // commit together, so a run is never recorded without its schedule
      // moving on (or vice versa).
      await prisma.$transaction([executionUpdate, scheduleUpdate]);

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

      await prisma.$transaction([
        prisma.scheduleExecution.update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            errorMessage: err.message,
            retryCount: { increment: 1 },
            nextRetryDate: new Date(Date.now() + 60 * 60 * 1000),
            lockedUntil: null,
            lockedBy: null,
          } as any,
        }),
        prisma.retirementSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunDate: new Date(),
            lastRunStatus: 'failed',
            lockedUntil: null,
            lockedBy: null,
          } as any,
        }),
      ]);

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

      const retireAmount = Math.min(remaining, credit.availableAmount ?? 0);
      if (retireAmount <= 0) continue;

      const retirement = await (this.prisma as any).$transaction(
        async (tx: any) => {
          await tx.credit.update({
            where: { id: credit.id },
            data: { availableAmount: { decrement: retireAmount } },
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
          availableAmount: { gt: 0 },
        },
        orderBy: { availableAmount: 'desc' },
      });
    }

    return this.prisma.credit.findMany({
      where: { availableAmount: { gt: 0 } },
      orderBy: { availableAmount: 'desc' },
      take: 20,
    });
  }
}
