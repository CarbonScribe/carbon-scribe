import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../../cache/redis.service';
import { ExecutorService } from './executor.service';
import { ReminderService } from './reminder.service';

export const SCHEDULER_RUNNER_LOCK_KEY = 'scheduling:runner';
export const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;
/** Must exceed the expected run time; renewed every third of the TTL. */
export const DEFAULT_RUNNER_LOCK_TTL_MS = 10 * 60 * 1000;

export type RunOnceResult =
  | { skipped: 'already-running' | 'lock-held' }
  | { skipped?: undefined; executorResult: any; reminderResult: any };

/**
 * Periodically executes due retirement schedules (#814).
 *
 * Safe for multi-instance deployments:
 *  1. `SCHEDULER_ENABLED=false` opts an instance (e.g. request-serving pods)
 *     out of running the job at all.
 *  2. An in-process `isRunning` guard stops a slow tick overlapping the next.
 *  3. A Redis lock (`scheduling:runner`, `SET NX PX` + Lua compare-and-delete,
 *     renewed while the run is in progress) lets only one instance run a tick.
 *     The TTL frees it automatically if the holder crashes.
 *  4. Independently of Redis, every schedule and retry is claimed atomically
 *     in the database (see ExecutorService), which is what guarantees
 *     exactly-once execution — so if Redis is unavailable the runner still
 *     proceeds safely on database claims alone.
 */
@Injectable()
export class SchedulingRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulingRunnerService.name);
  private intervalRef?: NodeJS.Timeout;
  private isRunning = false;

  private readonly lockTtlMs =
    Number(process.env.SCHEDULER_LOCK_TTL_MS) || DEFAULT_RUNNER_LOCK_TTL_MS;

  constructor(
    private readonly executorService: ExecutorService,
    private readonly reminderService: ReminderService,
    private readonly redisService: RedisService,
  ) {}

  /** `SCHEDULER_ENABLED` defaults to on; set it to `false` to opt out. */
  static isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    const value = (env.SCHEDULER_ENABLED ?? 'true').trim().toLowerCase();
    return !['false', '0', 'no', 'off'].includes(value);
  }

  onModuleInit() {
    if (!SchedulingRunnerService.isEnabled()) {
      this.logger.log(
        'Scheduler disabled on this instance (SCHEDULER_ENABLED)',
      );
      return;
    }
    this.intervalRef = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Scheduling runner failed: ${err.message}`);
      }
    }, SCHEDULER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  async runOnce(now: Date = new Date()): Promise<RunOnceResult> {
    if (this.isRunning) {
      this.logger.warn('Previous scheduling run still in progress; skipping');
      return { skipped: 'already-running' };
    }
    this.isRunning = true;

    let token: string | null | undefined;
    let renewRef: NodeJS.Timeout | undefined;
    try {
      try {
        token = await this.redisService.acquireLock(
          SCHEDULER_RUNNER_LOCK_KEY,
          this.lockTtlMs,
        );
        if (token === null) {
          this.logger.debug('Scheduling runner lock held by another instance');
          return { skipped: 'lock-held' };
        }
      } catch (error) {
        token = undefined;
        this.logger.warn(
          `Runner lock unavailable (${(error as Error).message}); relying on database claims`,
        );
      }

      if (token) {
        renewRef = this.startRenewal(token);
      }

      const [executorResult, reminderResult] = await Promise.all([
        this.executorService.executeDueSchedules(now),
        this.reminderService.sendDueReminders(now),
      ]);

      return { executorResult, reminderResult };
    } finally {
      if (renewRef) clearInterval(renewRef);
      if (token) {
        await this.redisService
          .releaseLock(SCHEDULER_RUNNER_LOCK_KEY, token)
          .catch((e: Error) =>
            this.logger.warn(`Failed to release runner lock: ${e.message}`),
          );
      }
      this.isRunning = false;
    }
  }

  private startRenewal(token: string): NodeJS.Timeout {
    const ref = setInterval(
      () => {
        this.redisService
          .extendLock(SCHEDULER_RUNNER_LOCK_KEY, token, this.lockTtlMs)
          .then((extended) => {
            if (!extended) {
              this.logger.warn(
                'Lost scheduling runner lock during run; database claims still prevent duplicates',
              );
            }
          })
          .catch((e: Error) =>
            this.logger.warn(`Failed to renew runner lock: ${e.message}`),
          );
      },
      Math.max(1000, Math.floor(this.lockTtlMs / 3)),
    );
    ref.unref?.();
    return ref;
  }
}
