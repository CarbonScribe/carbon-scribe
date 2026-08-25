import { Test, TestingModule } from '@nestjs/testing';
import { SorobanReconciliationService } from './soroban-reconciliation.service';
import { SorobanService } from '../soroban.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ContractCallStatus } from '../interfaces/idempotency.interface';
import {
  ReconciliationOutcome,
  classifyTransactionStatus,
  computeNextRetryAt,
  resolveReconciliationConfig,
} from '../interfaces/reconciliation.interface';
import { TimeoutError } from '../../../shared/exceptions/timeout-error';

interface ContractCallRow {
  id: string;
  transactionHash: string;
  status: string;
  submittedAt: Date;
  confirmedAt?: Date | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  lastRetryAt?: Date | null;
  errorMessage?: string | null;
  result?: unknown;
  isDuplicate: boolean;
}

/** Minimal Prisma stand-in over an array of ContractCall rows. */
function buildPrisma(rows: ContractCallRow[]) {
  const transfers: any[] = [];

  return {
    rows,
    transfers,
    contractCall: {
      findMany: jest.fn(async ({ where, take }: any) => {
        const now = new Date();
        return rows
          .filter(
            (row) =>
              row.status === where.status &&
              row.isDuplicate === where.isDuplicate &&
              (row.nextRetryAt === null || row.nextRetryAt <= now),
          )
          .slice(0, take ?? rows.length);
      }),
      findUnique: jest.fn(
        async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error(`no row ${where.id}`);
        Object.assign(row, data);
        return row;
      }),
    },
    creditTransfer: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const matched = transfers.filter(
          (t) =>
            t.transactionHash === where.transactionHash &&
            !where.status.notIn.includes(t.status),
        );
        for (const t of matched) Object.assign(t, data);
        return { count: matched.length };
      }),
    },
  };
}

function pendingCall(overrides: Partial<ContractCallRow> = {}): ContractCallRow {
  return {
    id: 'call-1',
    transactionHash: 'tx_abc',
    status: ContractCallStatus.PENDING,
    submittedAt: new Date(Date.now() - 60_000),
    confirmedAt: null,
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: null,
    isDuplicate: false,
    ...overrides,
  };
}

describe('SorobanReconciliationService', () => {
  let service: SorobanReconciliationService;
  let prisma: ReturnType<typeof buildPrisma>;
  let soroban: { getTransaction: jest.Mock };

  async function build(rows: ContractCallRow[]) {
    prisma = buildPrisma(rows);
    soroban = { getTransaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SorobanService, useValue: soroban },
      ],
    }).compile();

    service = module.get(SorobanReconciliationService);
  }

  beforeEach(async () => {
    await build([pendingCall()]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('selects PENDING calls whose nextRetryAt is null or due', async () => {
    await build([
      pendingCall({ id: 'due-null', nextRetryAt: null }),
      pendingCall({
        id: 'due-past',
        transactionHash: 'tx_2',
        nextRetryAt: new Date(Date.now() - 1000),
      }),
      pendingCall({
        id: 'not-due',
        transactionHash: 'tx_3',
        nextRetryAt: new Date(Date.now() + 600_000),
      }),
      pendingCall({
        id: 'already-confirmed',
        transactionHash: 'tx_4',
        status: ContractCallStatus.CONFIRMED,
      }),
    ]);

    const due = await service.findDueForReconciliation();

    expect(due.map((row: any) => row.id)).toEqual(['due-null', 'due-past']);
  });

  /**
   * The scenario the issue describes: the immediate post-submit status check
   * timed out, leaving the row PENDING, and the transaction later lands.
   */
  it('marks a late-landing transaction CONFIRMED without manual intervention', async () => {
    await build([pendingCall()]);

    // First check (inside invokeContract) timed out — reproduced here as the
    // reason the row is PENDING. The reconciliation lookup now succeeds.
    soroban.getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const summary = await service.reconcilePending();

    expect(summary.confirmedLate).toBe(1);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.CONFIRMED);
    expect(prisma.rows[0].confirmedAt).toBeInstanceOf(Date);
    expect(prisma.rows[0].nextRetryAt).toBeNull();
  });

  it('reads and updates retryCount / nextRetryAt when still unresolved', async () => {
    await build([pendingCall({ retryCount: 0, maxRetries: 3 })]);
    soroban.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    const before = Date.now();
    const summary = await service.reconcilePending();

    expect(summary.stillPending).toBe(1);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.PENDING);
    expect(prisma.rows[0].retryCount).toBe(1);
    expect(prisma.rows[0].nextRetryAt).toBeInstanceOf(Date);
    expect(prisma.rows[0].nextRetryAt!.getTime()).toBeGreaterThan(before);
  });

  it('backs off exponentially across successive attempts', async () => {
    await build([pendingCall({ retryCount: 0, maxRetries: 5 })]);
    soroban.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    await service.reconcilePending();
    const firstDelay =
      prisma.rows[0].nextRetryAt!.getTime() - Date.now();

    prisma.rows[0].nextRetryAt = null; // make it due again
    await service.reconcilePending();
    const secondDelay =
      prisma.rows[0].nextRetryAt!.getTime() - Date.now();

    expect(prisma.rows[0].retryCount).toBe(2);
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  it('parks a never-confirming call in the terminal UNRESOLVED state', async () => {
    await build([pendingCall({ retryCount: 2, maxRetries: 3 })]);
    soroban.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    const summary = await service.reconcilePending();

    expect(summary.givenUp).toBe(1);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.UNRESOLVED);
    expect(prisma.rows[0].nextRetryAt).toBeNull();
    expect(prisma.rows[0].retryCount).toBe(3);
  });

  it('stops revisiting a row once it reaches a terminal state', async () => {
    await build([pendingCall({ retryCount: 2, maxRetries: 3 })]);
    soroban.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    await service.reconcilePending();
    const second = await service.reconcilePending();

    expect(second.examined).toBe(0);
    expect(soroban.getTransaction).toHaveBeenCalledTimes(1);
  });

  it('marks a definitively failed transaction FAILED', async () => {
    await build([pendingCall()]);
    soroban.getTransaction.mockResolvedValue({
      status: 'FAILED',
      resultXdr: 'AAAA',
    });

    const summary = await service.reconcilePending();

    expect(summary.failed).toBe(1);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.FAILED);
    expect(prisma.rows[0].errorMessage).toBe('AAAA');
  });

  it('reschedules rather than failing when the RPC lookup itself throws', async () => {
    await build([pendingCall({ retryCount: 0, maxRetries: 3 })]);
    soroban.getTransaction.mockRejectedValue(
      new TimeoutError('getTransaction tx_abc timed out after 10000ms'),
    );

    const summary = await service.reconcilePending();

    expect(summary.checkFailed).toBe(1);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.PENDING);
    expect(prisma.rows[0].retryCount).toBe(1);
    expect(prisma.rows[0].errorMessage).toContain('timed out');
  });

  /**
   * End-to-end for the acceptance criterion: an RPC timeout on the initial
   * check, then a successful late confirmation via the reconciliation job.
   */
  it('recovers from an initial RPC timeout followed by a late confirmation', async () => {
    await build([pendingCall({ retryCount: 0, maxRetries: 3 })]);

    soroban.getTransaction
      .mockRejectedValueOnce(new TimeoutError('rpc timed out'))
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS', ledger: 1234 });

    // Sweep 1 — RPC unreachable.
    await service.reconcilePending();
    expect(prisma.rows[0].status).toBe(ContractCallStatus.PENDING);
    expect(prisma.rows[0].retryCount).toBe(1);

    // Sweep 2 — transaction not indexed yet.
    prisma.rows[0].nextRetryAt = null;
    await service.reconcilePending();
    expect(prisma.rows[0].status).toBe(ContractCallStatus.PENDING);
    expect(prisma.rows[0].retryCount).toBe(2);

    // Sweep 3 — it landed after all.
    prisma.rows[0].nextRetryAt = null;
    const summary = await service.reconcilePending();

    expect(summary.confirmedLate).toBe(1);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.CONFIRMED);
    expect(prisma.rows[0].confirmedAt).toBeInstanceOf(Date);
  });

  it('propagates a late confirmation to the transfer status the UI polls', async () => {
    await build([pendingCall()]);
    prisma.transfers.push({
      purchaseId: 'ord-1',
      transactionHash: 'tx_abc',
      status: 'PENDING',
      confirmedAt: null,
    });
    soroban.getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    await service.reconcilePending();

    expect(prisma.transfers[0].status).toBe('CONFIRMED');
    expect(prisma.transfers[0].confirmedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite a transfer that already reached a terminal state', async () => {
    await build([pendingCall()]);
    prisma.transfers.push({
      purchaseId: 'ord-1',
      transactionHash: 'tx_abc',
      status: 'FAILED',
    });
    soroban.getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    await service.reconcilePending();

    expect(prisma.transfers[0].status).toBe('FAILED');
  });

  it('reports an empty sweep without touching the RPC', async () => {
    await build([]);

    const summary = await service.reconcilePending();

    expect(summary.examined).toBe(0);
    expect(soroban.getTransaction).not.toHaveBeenCalled();
  });

  it('skips the scheduled sweep when disabled', async () => {
    const previous = process.env.SOROBAN_RECONCILIATION_ENABLED;
    process.env.SOROBAN_RECONCILIATION_ENABLED = 'false';
    try {
      await build([pendingCall()]);
      const result = await service.handleReconciliation();
      expect(result).toBeNull();
      expect(soroban.getTransaction).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined)
        delete process.env.SOROBAN_RECONCILIATION_ENABLED;
      else process.env.SOROBAN_RECONCILIATION_ENABLED = previous;
    }
  });

  it('supports forcing a single re-check by id', async () => {
    await build([pendingCall({ id: 'call-x', transactionHash: 'tx_x' })]);
    soroban.getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const result = await service.reconcileById('call-x');

    expect(result.outcome).toBe(ReconciliationOutcome.CONFIRMED_LATE);
    expect(prisma.rows[0].status).toBe(ContractCallStatus.CONFIRMED);
  });

  it('surfaces a sweep summary for metrics', async () => {
    await build([
      pendingCall({ id: 'a', transactionHash: 'tx_a' }),
      pendingCall({ id: 'b', transactionHash: 'tx_b' }),
    ]);
    soroban.getTransaction
      .mockResolvedValueOnce({ status: 'SUCCESS' })
      .mockResolvedValueOnce({ status: 'NOT_FOUND' });

    const summary = await service.reconcilePending();

    expect(summary).toEqual(
      expect.objectContaining({
        examined: 2,
        confirmedLate: 1,
        stillPending: 1,
        failed: 0,
        givenUp: 0,
        checkFailed: 0,
      }),
    );
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Pure helpers ───────────────────────────────────────────────────────────

describe('reconciliation helpers', () => {
  it('classifies RPC statuses, treating NOT_FOUND as still pending', () => {
    expect(classifyTransactionStatus({ status: 'SUCCESS' })).toBe('CONFIRMED');
    expect(classifyTransactionStatus({ status: 'success' })).toBe('CONFIRMED');
    expect(classifyTransactionStatus({ status: 'FAILED' })).toBe('FAILED');
    expect(classifyTransactionStatus({ status: 'ERROR' })).toBe('FAILED');
    expect(classifyTransactionStatus({ status: 'NOT_FOUND' })).toBe('PENDING');
    expect(classifyTransactionStatus(null)).toBe('PENDING');
    expect(classifyTransactionStatus(undefined)).toBe('PENDING');
  });

  it('grows the backoff delay and caps it', () => {
    const config = {
      ...resolveReconciliationConfig(),
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
    };
    const from = new Date(0);

    expect(computeNextRetryAt(0, config, from).getTime()).toBe(1000);
    expect(computeNextRetryAt(1, config, from).getTime()).toBe(2000);
    expect(computeNextRetryAt(2, config, from).getTime()).toBe(4000);
    expect(computeNextRetryAt(9, config, from).getTime()).toBe(5000);
  });

  it('reads configuration from the environment with safe defaults', () => {
    const config = resolveReconciliationConfig();
    expect(config.batchSize).toBeGreaterThan(0);
    expect(config.baseDelayMs).toBeGreaterThan(0);
    expect(config.defaultMaxRetries).toBeGreaterThan(0);
  });
});
