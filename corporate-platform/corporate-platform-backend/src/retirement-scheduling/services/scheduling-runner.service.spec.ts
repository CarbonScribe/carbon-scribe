import {
  SCHEDULER_RUNNER_LOCK_KEY,
  SchedulingRunnerService,
} from './scheduling-runner.service';

/** Shared in-memory Redis lock with NX + TTL + compare-and-delete semantics. */
function createFakeRedis() {
  const locks = new Map<string, { token: string; expiresAt: number }>();
  let n = 0;
  return {
    locks,
    acquireLock: jest.fn(async (key: string, ttlMs: number) => {
      const held = locks.get(key);
      if (held && held.expiresAt > Date.now()) return null;
      const token = `tok_${++n}`;
      locks.set(key, { token, expiresAt: Date.now() + ttlMs });
      return token;
    }),
    releaseLock: jest.fn(async (key: string, token: string) => {
      if (locks.get(key)?.token !== token) return false;
      locks.delete(key);
      return true;
    }),
    extendLock: jest.fn(async (key: string, token: string, ttlMs: number) => {
      const held = locks.get(key);
      if (held?.token !== token) return false;
      held.expiresAt = Date.now() + ttlMs;
      return true;
    }),
  };
}

describe('SchedulingRunnerService (#814)', () => {
  let redis: ReturnType<typeof createFakeRedis>;
  let executor: { executeDueSchedules: jest.Mock };
  let reminders: { sendDueReminders: jest.Mock };

  const slowRun = () =>
    new Promise((resolve) => setTimeout(() => resolve({ processed: 1 }), 20));

  beforeEach(() => {
    redis = createFakeRedis();
    executor = { executeDueSchedules: jest.fn(slowRun) };
    reminders = { sendDueReminders: jest.fn().mockResolvedValue({ sent: 0 }) };
  });

  const newRunner = () =>
    new SchedulingRunnerService(
      executor as any,
      reminders as any,
      redis as any,
    );

  it('runs only one tick at a time across two instances', async () => {
    const [a, b] = await Promise.all([
      newRunner().runOnce(),
      newRunner().runOnce(),
    ]);

    expect(executor.executeDueSchedules).toHaveBeenCalledTimes(1);
    expect([a.skipped, b.skipped].filter(Boolean)).toEqual(['lock-held']);
    // Lock released afterwards so the next tick can run.
    expect(redis.locks.has(SCHEDULER_RUNNER_LOCK_KEY)).toBe(false);
  });

  it('prevents overlapping ticks on a single instance', async () => {
    const runner = newRunner();
    const [a, b] = await Promise.all([runner.runOnce(), runner.runOnce()]);

    expect(executor.executeDueSchedules).toHaveBeenCalledTimes(1);
    expect(b.skipped ?? a.skipped).toBe('already-running');

    // Guard resets after completion.
    await runner.runOnce();
    expect(executor.executeDueSchedules).toHaveBeenCalledTimes(2);
  });

  it('reclaims the runner lock after the previous holder crashed and its TTL expired', async () => {
    redis.locks.set(SCHEDULER_RUNNER_LOCK_KEY, {
      token: 'crashed',
      expiresAt: Date.now() - 1,
    });
    const result = await newRunner().runOnce();
    expect(result.skipped).toBeUndefined();
    expect(executor.executeDueSchedules).toHaveBeenCalledTimes(1);
  });

  it('releases the lock and the guard even when the run throws', async () => {
    executor.executeDueSchedules.mockRejectedValueOnce(new Error('boom'));
    const runner = newRunner();
    await expect(runner.runOnce()).rejects.toThrow('boom');
    expect(redis.locks.size).toBe(0);
    await expect(runner.runOnce()).resolves.toMatchObject({
      executorResult: { processed: 1 },
    });
  });

  it('falls back to database claims when Redis is unavailable', async () => {
    redis.acquireLock.mockRejectedValueOnce(new Error('Redis unavailable'));
    const result = await newRunner().runOnce();
    expect(result.skipped).toBeUndefined();
    expect(executor.executeDueSchedules).toHaveBeenCalledTimes(1);
    expect(redis.releaseLock).not.toHaveBeenCalled();
  });

  it('renews the lock during long runs', async () => {
    process.env.SCHEDULER_LOCK_TTL_MS = '3000';
    jest.useFakeTimers();
    try {
      let finish!: () => void;
      executor.executeDueSchedules.mockImplementationOnce(
        () => new Promise<void>((r) => (finish = r)),
      );
      const runner = newRunner();
      const run = runner.runOnce();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(2500);
      expect(redis.extendLock).toHaveBeenCalledWith(
        SCHEDULER_RUNNER_LOCK_KEY,
        expect.any(String),
        3000,
      );
      finish();
      await run;
    } finally {
      jest.useRealTimers();
      delete process.env.SCHEDULER_LOCK_TTL_MS;
    }
  });

  describe('SCHEDULER_ENABLED', () => {
    afterEach(() => {
      delete process.env.SCHEDULER_ENABLED;
    });

    it('defaults to enabled', () => {
      expect(SchedulingRunnerService.isEnabled({})).toBe(true);
    });

    it.each(['false', '0', 'off', 'NO'])('is disabled by %p', (value) => {
      expect(
        SchedulingRunnerService.isEnabled({ SCHEDULER_ENABLED: value }),
      ).toBe(false);
    });

    it('does not start the interval when disabled', () => {
      process.env.SCHEDULER_ENABLED = 'false';
      const spy = jest.spyOn(global, 'setInterval');
      const runner = newRunner();
      runner.onModuleInit();
      expect(spy).not.toHaveBeenCalled();
      runner.onModuleDestroy();
      spy.mockRestore();
    });
  });
});
