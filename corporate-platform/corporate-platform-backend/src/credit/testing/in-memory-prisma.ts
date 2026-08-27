/**
 * A small in-memory Prisma stand-in that models the two behaviours the
 * inventory-safety tests actually depend on (#516):
 *
 *  1. `SELECT ... FOR UPDATE` row locks — `$queryRaw` on a credit id blocks
 *     until any other in-flight transaction holding that row commits or rolls
 *     back. Without this, a "concurrency test" against a plain object graph
 *     proves nothing, because JS callbacks never truly interleave mid-await.
 *  2. Transactional isolation — writes are buffered per transaction and merged
 *     on commit, so a rolled-back transaction leaves no trace and a concurrent
 *     transaction cannot read another's uncommitted state.
 *
 * It is deliberately narrow: only the models and operations the cart, checkout,
 * and retirement flows use are implemented.
 */

export interface CreditRow {
  id: string;
  companyId?: string | null;
  projectName: string;
  availableAmount: number;
  totalAmount?: number;
  status?: string | null;
}

export interface ReservationRow {
  cartId: string;
  creditId: string;
  quantity: number;
  expiresAt: Date;
}

export interface AvailabilityLogRow {
  creditId: string;
  changedBy: string | null;
  changeType: string;
  amount: number;
  previousAmount: number;
  newAmount: number;
  reason: string | null;
}

type Where = Record<string, any>;

/** Evaluate a (small) subset of Prisma `where` semantics against a row. */
function matches(row: Record<string, any>, where: Where | undefined): boolean {
  if (!where) return true;

  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') {
      return (condition as Where[]).some((clause) => matches(row, clause));
    }
    if (key === 'AND') {
      return (condition as Where[]).every((clause) => matches(row, clause));
    }
    if (key === 'NOT') {
      return !matches(row, condition as Where);
    }

    const value = row[key];

    if (
      condition !== null &&
      typeof condition === 'object' &&
      !(condition instanceof Date)
    ) {
      return Object.entries(condition as Record<string, any>).every(
        ([operator, operand]) => {
          switch (operator) {
            case 'gte':
              return value >= operand;
            case 'gt':
              return value > operand;
            case 'lte':
              return value <= operand;
            case 'lt':
              return value < operand;
            case 'not':
              return value !== operand;
            case 'in':
              return (operand as unknown[]).includes(value);
            case 'notIn':
              return !(operand as unknown[]).includes(value);
            case 'equals':
              return value === operand;
            default:
              return false;
          }
        },
      );
    }

    return value === condition;
  });
}

class TransactionContext {
  /** Buffered credit writes, applied to the base store on commit. */
  readonly creditWrites = new Map<string, CreditRow>();
  readonly reservationWrites: ReservationRow[] = [];
  readonly reservationDeletes: Array<(row: ReservationRow) => boolean> = [];
  readonly logWrites: AvailabilityLogRow[] = [];
  readonly retirementWrites: Record<string, any>[] = [];
  /** Lock releases held by this transaction, invoked when it settles. */
  readonly lockReleases: Array<() => void> = [];
  /**
   * Rows this transaction already holds. Postgres row locks are re-entrant
   * within a transaction, so re-locking the same row must not deadlock — the
   * retirement flow locks once to validate and again to decrement.
   */
  readonly heldLocks = new Set<string>();
}

export class InMemoryPrisma {
  credits = new Map<string, CreditRow>();
  reservations: ReservationRow[] = [];
  availabilityLogs: AvailabilityLogRow[] = [];
  retirements: Record<string, any>[] = [];

  /** Tail of the wait-queue for each locked credit id. */
  private lockQueue = new Map<string, Promise<void>>();
  private retirementSeq = 0;

  /** How many transactions have been started (useful for assertions). */
  transactionCount = 0;
  /** Isolation levels requested by callers, in order. */
  readonly isolationLevels: (string | undefined)[] = [];
  /**
   * Extra model stubs (order, cart, …) exposed on both the base client and on
   * every transaction client, so a test can exercise a flow that touches models
   * this fake does not implement.
   */
  private readonly extras: Record<string, unknown> = {};

  /** Register a hand-rolled model stub, visible inside and outside transactions. */
  registerModel(name: string, implementation: unknown): void {
    this.extras[name] = implementation;
    (this as unknown as Record<string, unknown>)[name] = implementation;
  }

  constructor(credits: CreditRow[] = [], reservations: ReservationRow[] = []) {
    for (const credit of credits) {
      this.credits.set(credit.id, { ...credit });
    }
    this.reservations = reservations.map((r) => ({ ...r }));
  }

  /** Base-store accessors, used by callers outside a transaction. */
  get credit() {
    return this.buildCreditApi(null);
  }

  get creditReservation() {
    return this.buildReservationApi(null);
  }

  get creditAvailabilityLog() {
    return this.buildLogApi(null);
  }

  get retirement() {
    return this.buildRetirementApi(null);
  }

  async $transaction<T>(
    fn: (tx: any) => Promise<T>,
    options?: { isolationLevel?: string },
  ): Promise<T> {
    this.transactionCount += 1;
    this.isolationLevels.push(options?.isolationLevel);

    const ctx = new TransactionContext();
    const client = this.buildClient(ctx);

    try {
      const result = await fn(client);
      this.commit(ctx);
      return result;
    } finally {
      // Locks are held for the whole transaction and released once it settles,
      // whether it committed or rolled back.
      for (const release of ctx.lockReleases) release();
    }
  }

  private commit(ctx: TransactionContext): void {
    for (const [id, row] of ctx.creditWrites) {
      this.credits.set(id, row);
    }
    for (const predicate of ctx.reservationDeletes) {
      this.reservations = this.reservations.filter((row) => !predicate(row));
    }
    for (const row of ctx.reservationWrites) {
      const index = this.reservations.findIndex(
        (existing) =>
          existing.cartId === row.cartId && existing.creditId === row.creditId,
      );
      if (index === -1) this.reservations.push(row);
      else this.reservations[index] = row;
    }
    this.availabilityLogs.push(...ctx.logWrites);
    this.retirements.push(...ctx.retirementWrites);
  }

  private buildClient(ctx: TransactionContext) {
    return {
      ...this.extras,
      credit: this.buildCreditApi(ctx),
      creditReservation: this.buildReservationApi(ctx),
      creditAvailabilityLog: this.buildLogApi(ctx),
      retirement: this.buildRetirementApi(ctx),
      $queryRaw: (query: any) => this.queryRaw(ctx, query),
    };
  }

  /**
   * Only `SELECT ... FOR UPDATE` is understood. The credit id is taken from the
   * tagged-template parameter list that `Prisma.sql` produces.
   */
  private async queryRaw(
    ctx: TransactionContext | null,
    query: any,
  ): Promise<unknown[]> {
    const sql: string = query?.sql ?? query?.strings?.join('?') ?? '';
    const creditId = query?.values?.[0];

    if (!/FOR UPDATE/i.test(sql) || typeof creditId !== 'string') {
      return [];
    }

    if (ctx) await this.acquireLock(ctx, creditId);

    const row = this.readCredit(ctx, creditId);
    return row ? [{ id: row.id }] : [];
  }

  /** Serialise access to one credit row across concurrent transactions. */
  private async acquireLock(
    ctx: TransactionContext,
    creditId: string,
  ): Promise<void> {
    // Re-entrant, like a Postgres row lock held by the same transaction.
    if (ctx.heldLocks.has(creditId)) return;
    ctx.heldLocks.add(creditId);

    const previous = this.lockQueue.get(creditId) ?? Promise.resolve();

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.lockQueue.set(
      creditId,
      previous.then(() => held),
    );

    await previous;
    ctx.lockReleases.push(release);
  }

  private readCredit(
    ctx: TransactionContext | null,
    id: string,
  ): CreditRow | undefined {
    return ctx?.creditWrites.get(id) ?? this.credits.get(id);
  }

  private allCredits(ctx: TransactionContext | null): CreditRow[] {
    return Array.from(this.credits.keys()).map(
      (id) => this.readCredit(ctx, id) as CreditRow,
    );
  }

  private allReservations(ctx: TransactionContext | null): ReservationRow[] {
    let rows = this.reservations;
    if (ctx) {
      for (const predicate of ctx.reservationDeletes) {
        rows = rows.filter((row) => !predicate(row));
      }
      rows = [...rows];
      for (const write of ctx.reservationWrites) {
        const index = rows.findIndex(
          (existing) =>
            existing.cartId === write.cartId &&
            existing.creditId === write.creditId,
        );
        if (index === -1) rows.push(write);
        else rows[index] = write;
      }
    }
    return rows;
  }

  private buildCreditApi(ctx: TransactionContext | null) {
    return {
      findFirst: async ({ where }: { where?: Where } = {}) =>
        this.allCredits(ctx).find((row) => matches(row, where)) ?? null,

      findUnique: async ({ where }: { where: Where }) =>
        this.readCredit(ctx, where.id as string) ?? null,

      findMany: async ({ where }: { where?: Where } = {}) =>
        this.allCredits(ctx).filter((row) => matches(row, where)),

      count: async ({ where }: { where?: Where } = {}) =>
        this.allCredits(ctx).filter((row) => matches(row, where)).length,

      updateMany: async ({ where, data }: { where?: Where; data: any }) => {
        const targets = this.allCredits(ctx).filter((row) =>
          matches(row, where),
        );
        for (const row of targets) {
          const next = { ...row, ...this.applyData(row, data) };
          if (ctx) ctx.creditWrites.set(row.id, next);
          else this.credits.set(row.id, next);
        }
        return { count: targets.length };
      },

      update: async ({ where, data }: { where: Where; data: any }) => {
        const row = this.allCredits(ctx).find((candidate) =>
          matches(candidate, where),
        );
        if (!row) {
          throw new Error(
            `Credit not found for update: ${JSON.stringify(where)}`,
          );
        }
        const next = { ...row, ...this.applyData(row, data) };
        if (ctx) ctx.creditWrites.set(row.id, next);
        else this.credits.set(row.id, next);
        return next;
      },
    };
  }

  /** Support Prisma's `{ decrement }` / `{ increment }` atomic-update sugar. */
  private applyData(row: Record<string, any>, data: any): Record<string, any> {
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(data ?? {})) {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        const op = value as Record<string, number>;
        if ('decrement' in op) {
          patch[key] = (row[key] ?? 0) - op.decrement;
          continue;
        }
        if ('increment' in op) {
          patch[key] = (row[key] ?? 0) + op.increment;
          continue;
        }
        if ('set' in op) {
          patch[key] = (op as any).set;
          continue;
        }
      }
      patch[key] = value;
    }
    return patch;
  }

  private buildReservationApi(ctx: TransactionContext | null) {
    return {
      findMany: async ({ where }: { where?: Where } = {}) =>
        this.allReservations(ctx).filter((row) => matches(row, where)),

      aggregate: async ({ where }: { where?: Where } = {}) => {
        const rows = this.allReservations(ctx).filter((row) =>
          matches(row, where),
        );
        const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
        return { _sum: { quantity: rows.length ? quantity : null } };
      },

      upsert: async ({ where, update, create }: any) => {
        const { cartId, creditId } = where.cartId_creditId;
        const existing = this.allReservations(ctx).find(
          (row) => row.cartId === cartId && row.creditId === creditId,
        );
        const row: ReservationRow = existing
          ? { ...existing, ...update }
          : { ...create };

        if (ctx) ctx.reservationWrites.push(row);
        else {
          const index = this.reservations.findIndex(
            (candidate) =>
              candidate.cartId === cartId && candidate.creditId === creditId,
          );
          if (index === -1) this.reservations.push(row);
          else this.reservations[index] = row;
        }
        return row;
      },

      deleteMany: async ({ where }: { where?: Where } = {}) => {
        const targets = this.allReservations(ctx).filter((row) =>
          matches(row, where),
        );
        const predicate = (row: ReservationRow) => matches(row, where);
        if (ctx) ctx.reservationDeletes.push(predicate);
        else
          this.reservations = this.reservations.filter(
            (row) => !predicate(row),
          );
        return { count: targets.length };
      },
    };
  }

  private buildLogApi(ctx: TransactionContext | null) {
    return {
      create: async ({ data }: { data: AvailabilityLogRow }) => {
        const row = { ...data };
        if (ctx) ctx.logWrites.push(row);
        else this.availabilityLogs.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: Where } = {}) =>
        this.availabilityLogs.filter((row) => matches(row, where)),
    };
  }

  private buildRetirementApi(ctx: TransactionContext | null) {
    const pending = () => (ctx ? ctx.retirementWrites : this.retirements);

    return {
      create: async ({ data }: { data: any }) => {
        this.retirementSeq += 1;
        const row = { id: `ret_${this.retirementSeq}`, ...data };
        pending().push(row);
        return row;
      },
      update: async ({ where, data }: { where: Where; data: any }) => {
        const rows = ctx ? ctx.retirementWrites : this.retirements;
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error(`Retirement not found: ${where.id}`);
        Object.assign(row, data);
        return row;
      },
    };
  }
}
