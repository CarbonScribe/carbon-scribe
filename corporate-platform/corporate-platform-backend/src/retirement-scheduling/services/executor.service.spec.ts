import { ExecutorService } from './executor.service';

/** Minimal Prisma `where` evaluator for the fields the executor uses. */
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([field, cond]: [string, any]) => {
    if (field === 'OR') return cond.some((c: any) => matches(row, c));
    if (field === 'AND') return cond.every((c: any) => matches(row, c));
    const value = row[field];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date || typeof cond !== 'object') return value === cond;
    if (value === null || value === undefined) return false;
    if ('lte' in cond && !(value <= cond.lte)) return false;
    if ('lt' in cond && !(value < cond.lt)) return false;
    if ('gte' in cond && !(value >= cond.gte)) return false;
    return true;
  });
}

function apply(row: any, data: any) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && 'increment' in (v as any)) {
      row[k] = (row[k] ?? 0) + (v as any).increment;
    } else {
      row[k] = v;
    }
  }
  return { ...row };
}

/**
 * In-memory stand-in for the two tables. `updateMany` evaluates and writes
 * synchronously, i.e. atomically with respect to other callers — the same
 * guarantee a single conditional UPDATE statement gives in Postgres.
 */
function createFakePrisma() {
  const schedules = new Map<string, any>();
  const executions = new Map<string, any>();
  let seq = 0;
  const table = (rows: Map<string, any>) => ({
    findMany: jest.fn(async ({ where }: any) =>
      [...rows.values()]
        .filter((r) => matches(r, where))
        .map((r) => ({ ...r })),
    ),
    findUnique: jest.fn(async ({ where }: any) => {
      const row = rows.get(where.id);
      return row ? { ...row } : null;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hits = [...rows.values()].filter((r) => matches(r, where));
      hits.forEach((r) => apply(r, data));
      return { count: hits.length };
    }),
    update: jest.fn(async ({ where, data }: any) =>
      apply(rows.get(where.id), data),
    ),
    create: jest.fn(async ({ data }: any) => {
      const row = {
        id: `exec_${++seq}`,
        retryCount: 0,
        lockedUntil: null,
        ...data,
      };
      rows.set(row.id, row);
      return { ...row };
    }),
  });
  return {
    schedules,
    executions,
    retirementSchedule: table(schedules),
    scheduleExecution: table(executions),
    $transaction: jest.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
  };
}

const scheduleService = {
  calculateNextRunDate: (from: Date) =>
    new Date(from.getTime() + 24 * 60 * 60 * 1000),
};

function dueSchedule(id: string, nextRunDate: Date) {
  return {
    id,
    companyId: 'c1',
    createdBy: 'u1',
    name: id,
    amount: 5,
    frequency: 'daily',
    interval: 1,
    isActive: true,
    endDate: null,
    nextRunDate,
    notifyAfter: false,
    lockedUntil: null,
    lockedBy: null,
    runCount: 0,
  };
}

describe('ExecutorService', () => {
  const now = new Date('2026-02-23T12:00:00.000Z');
  let prisma: ReturnType<typeof createFakePrisma>;
  let performRetirement: jest.SpyInstance;

  beforeEach(() => {
    prisma = createFakePrisma();
    performRetirement = jest
      .spyOn(ExecutorService.prototype as any, 'performRetirement')
      .mockImplementation(async () => {
        // Yield so concurrent runners genuinely interleave.
        await new Promise((r) => setTimeout(r, 5));
        return {
          amountRetired: 5,
          retirementIds: ['ret_1'],
          remainingAmount: 0,
        };
      });
  });

  afterEach(() => jest.restoreAllMocks());

  const newInstance = () =>
    new ExecutorService(prisma as any, scheduleService as any);

  it('identifies and executes only due schedules', async () => {
    prisma.schedules.set(
      'due_1',
      dueSchedule('due_1', new Date(now.getTime() - 1000)),
    );
    prisma.schedules.set('due_2', dueSchedule('due_2', now));
    prisma.schedules.set(
      'future',
      dueSchedule('future', new Date(now.getTime() + 60_000)),
    );

    const result = await newInstance().executeDueSchedules(now);

    expect(prisma.retirementSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          nextRunDate: { lte: now },
        }),
      }),
    );
    expect(result.processedSchedules).toBe(2);
    expect(performRetirement).toHaveBeenCalledTimes(2);
  });

  it('executes each due schedule exactly once across two concurrent runners (#814)', async () => {
    prisma.schedules.set('s1', dueSchedule('s1', now));
    prisma.schedules.set('s2', dueSchedule('s2', now));

    const [a, b] = await Promise.all([
      newInstance().executeDueSchedules(now),
      newInstance().executeDueSchedules(now),
    ]);

    expect(performRetirement).toHaveBeenCalledTimes(2);
    expect(a.processedSchedules + b.processedSchedules).toBe(2);
    expect(a.skippedClaims + b.skippedClaims).toBe(2);
    for (const id of ['s1', 's2']) {
      const s = prisma.schedules.get(id);
      expect(s.runCount).toBe(1);
      expect(s.nextRunDate.getTime()).toBeGreaterThan(now.getTime());
      expect(s.lockedUntil).toBeNull();
    }
    expect(prisma.executions.size).toBe(2);
  });

  it('does not re-run a schedule another instance already advanced', async () => {
    prisma.schedules.set('s1', dueSchedule('s1', now));
    await newInstance().executeDueSchedules(now);
    await newInstance().executeDueSchedules(now);
    expect(performRetirement).toHaveBeenCalledTimes(1);
  });

  it('skips a schedule whose lease is held and reclaims it once the lease expires', async () => {
    const held = {
      ...dueSchedule('s1', now),
      lockedUntil: new Date(now.getTime() + 60_000),
      lockedBy: 'crashed-instance',
    };
    prisma.schedules.set('s1', held);

    const first = await newInstance().executeDueSchedules(now);
    expect(first.processedSchedules).toBe(0);
    expect(performRetirement).not.toHaveBeenCalled();

    // The holder crashed; after its lease expires the row is reclaimable.
    const later = new Date(now.getTime() + 61_000);
    const second = await newInstance().executeDueSchedules(later);
    expect(second.processedSchedules).toBe(1);
    expect(performRetirement).toHaveBeenCalledTimes(1);
    expect(prisma.schedules.get('s1').lockedUntil).toBeNull();
  });

  it('retries a failed execution exactly once across two concurrent runners', async () => {
    // A schedule whose last run failed: still "due", plus a retriable row.
    prisma.schedules.set('s1', {
      ...dueSchedule('s1', new Date(now.getTime() + 60_000)),
    });
    prisma.executions.set('exec_failed', {
      id: 'exec_failed',
      scheduleId: 's1',
      status: 'failed',
      retryCount: 1,
      nextRetryDate: now,
      lockedUntil: null,
      lockedBy: null,
    });

    const [a, b] = await Promise.all([
      newInstance().executeDueSchedules(now),
      newInstance().executeDueSchedules(now),
    ]);

    expect(a.retriedExecutions + b.retriedExecutions).toBe(1);
    expect(performRetirement).toHaveBeenCalledTimes(1);
    expect(prisma.executions.get('exec_failed').status).toBe('completed');
    expect(prisma.executions.get('exec_failed').lockedUntil).toBeNull();
  });

  it('commits the execution record and nextRunDate advance in one transaction', async () => {
    prisma.schedules.set('s1', dueSchedule('s1', now));
    await newInstance().executeDueSchedules(now);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('refuses a manual run while another runner holds the schedule', async () => {
    prisma.schedules.set('s1', {
      ...dueSchedule('s1', now),
      lockedUntil: new Date(Date.now() + 60_000),
    });
    const result = await newInstance().executeNow('s1');
    expect(result.status).toBe('failed');
    expect(performRetirement).not.toHaveBeenCalled();
  });
});
