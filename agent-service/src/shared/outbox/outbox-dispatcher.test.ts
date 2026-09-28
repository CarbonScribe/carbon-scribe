import { describe, expect, it, vi } from "vitest";
import { AlertTriageEscalateHandler } from "./alert-triage-escalate.handler.js";
import { ActionHandlerRegistry } from "./handler-registry.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";
import type { ClaimedAction, OutboxRepository } from "./outbox.types.js";

const OPTIONS = {
  pollIntervalMs: 1000,
  batchSize: 10,
  maxAttempts: 3,
  lockTimeoutMs: 1000,
  retryBaseMs: 1,
  retryMaxMs: 2,
};

function createAction(overrides: Partial<ClaimedAction> = {}): ClaimedAction {
  return {
    id: "42",
    requestId: "req-dispatch",
    agent: "alert-triage",
    actionType: "alert-triage.escalate",
    target: { projectId: "project-1", alertId: "alert-1" },
    payload: { output: { verdict: "escalate" } },
    reviewer: "reviewer-7",
    callingService: "project-portal",
    attemptCount: 0,
    requestedBy: "project-portal",
    ...overrides,
  };
}

class MemoryOutboxRepository implements OutboxRepository {
  readonly rows: Array<ClaimedAction & { status: string; lastError?: string }>;
  readonly audit: Array<{ requestId: string; status: string }> = [];

  constructor(actions: ClaimedAction[]) {
    this.rows = actions.map((action) => ({ ...action, status: "pending" }));
  }

  async claimBatch(
    limit: number,
    maxAttempts: number,
  ): Promise<ClaimedAction[]> {
    const claimed = this.rows
      .filter(
        (row) => row.status === "pending" && row.attemptCount < maxAttempts,
      )
      .slice(0, limit);
    for (const row of claimed) {
      row.status = "processing";
      row.attemptCount += 1;
    }
    return claimed.map(
      ({ status: _status, lastError: _lastError, ...row }) => ({
        ...row,
      }),
    );
  }

  async markProcessed(action: ClaimedAction): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === action.id)!;
    row.status = "processed";
    this.audit.push({
      requestId: action.requestId,
      status: "dispatch-processed",
    });
  }

  async markFailed(
    action: ClaimedAction,
    error: string,
    options: { retryAt: string; terminal: boolean },
  ): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === action.id)!;
    row.status = options.terminal ? "failed" : "pending";
    row.lastError = error;
    this.audit.push({
      requestId: action.requestId,
      status: options.terminal ? "dispatch-failed" : "dispatch-retry",
    });
  }
}

function createDispatcher(
  repository: OutboxRepository,
  registry = new ActionHandlerRegistry(),
  options = OPTIONS,
) {
  return new OutboxDispatcher(repository, registry, options);
}

describe("OutboxDispatcher", () => {
  it("dispatches an approved action once with the outbox ID as idempotency key", async () => {
    const repository = new MemoryOutboxRepository([createAction()]);
    const handler = { handle: vi.fn().mockResolvedValue(undefined) };
    const registry = new ActionHandlerRegistry();
    registry.register("alert-triage.escalate", handler);

    await createDispatcher(repository, registry).dispatchOnce();

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(handler.handle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "42", requestId: "req-dispatch" }),
      { idempotencyKey: "42", attempt: 1 },
    );
    expect(repository.rows[0]?.status).toBe("processed");
    expect(repository.audit[0]).toEqual({
      requestId: "req-dispatch",
      status: "dispatch-processed",
    });
  });

  it("reuses the same idempotency key after a retry so an applied effect is not repeated", async () => {
    const repository = new MemoryOutboxRepository([createAction()]);
    const appliedKeys = new Set<string>();
    let effectCount = 0;
    const handler = {
      handle: vi.fn(async (_action, ctx: { idempotencyKey: string }) => {
        if (!appliedKeys.has(ctx.idempotencyKey)) {
          appliedKeys.add(ctx.idempotencyKey);
          effectCount += 1;
          throw new Error("ack lost after effect");
        }
      }),
    };
    const registry = new ActionHandlerRegistry();
    registry.register("alert-triage.escalate", handler);
    const dispatcher = createDispatcher(repository, registry);

    await dispatcher.dispatchOnce();
    await dispatcher.dispatchOnce();

    expect(handler.handle).toHaveBeenCalledTimes(2);
    expect(
      handler.handle.mock.calls.map((call) => call[1].idempotencyKey),
    ).toEqual(["42", "42"]);
    expect(effectCount).toBe(1);
    expect(repository.rows[0]?.status).toBe("processed");
  });

  it("marks repeatedly failing actions failed after the configured maximum attempts", async () => {
    const repository = new MemoryOutboxRepository([createAction()]);
    const handler = {
      handle: vi.fn().mockRejectedValue(new Error("downstream unavailable")),
    };
    const registry = new ActionHandlerRegistry();
    registry.register("alert-triage.escalate", handler);
    const dispatcher = createDispatcher(repository, registry);

    await dispatcher.dispatchOnce();
    await dispatcher.dispatchOnce();
    await dispatcher.dispatchOnce();
    await dispatcher.dispatchOnce();

    expect(handler.handle).toHaveBeenCalledTimes(3);
    expect(repository.rows[0]?.status).toBe("failed");
    expect(repository.rows[0]?.lastError).toBe("downstream unavailable");
    expect(repository.audit.at(-1)?.status).toBe("dispatch-failed");
  });

  it("marks unknown action types failed without retrying or dropping them", async () => {
    const repository = new MemoryOutboxRepository([
      createAction({ actionType: "future.unregistered-action" }),
    ]);

    await createDispatcher(repository).dispatchOnce();

    expect(repository.rows[0]?.status).toBe("failed");
    expect(repository.rows[0]?.lastError).toContain(
      "unknown action type: future.unregistered-action",
    );
    expect(repository.audit[0]?.status).toBe("dispatch-failed");
  });

  it("fails a legacy action cleanly when its input snapshot is null", async () => {
    const repository = new MemoryOutboxRepository([
      createAction({ target: null }),
    ]);
    const notifier = { notify: vi.fn().mockResolvedValue(undefined) };
    const registry = new ActionHandlerRegistry();
    registry.register(
      "alert-triage.escalate",
      new AlertTriageEscalateHandler(notifier),
    );

    await createDispatcher(repository, registry).dispatchOnce();

    expect(notifier.notify).not.toHaveBeenCalled();
    expect(repository.rows[0]?.status).toBe("failed");
    expect(repository.rows[0]?.lastError).toContain(
      "original input snapshot is null",
    );
  });

  it("does not claim the same row in two concurrent dispatchers", async () => {
    const repository = new MemoryOutboxRepository([createAction()]);
    const handler = { handle: vi.fn().mockResolvedValue(undefined) };
    const registry = new ActionHandlerRegistry();
    registry.register("alert-triage.escalate", handler);

    await Promise.all([
      createDispatcher(repository, registry).dispatchOnce(),
      createDispatcher(repository, registry).dispatchOnce(),
    ]);

    expect(handler.handle).toHaveBeenCalledTimes(1);
  });
});
