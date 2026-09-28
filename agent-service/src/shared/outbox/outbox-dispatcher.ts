import { PermanentActionError } from "./outbox.types.js";
import type { ActionHandlerRegistry } from "./handler-registry.js";
import type { OutboxRepository } from "./outbox.types.js";

export interface OutboxDispatcherOptions {
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  lockTimeoutMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

export class OutboxDispatcher {
  private interval: NodeJS.Timeout | undefined;
  private polling = false;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly handlers: ActionHandlerRegistry,
    private readonly options: OutboxDispatcherOptions,
  ) {}

  start(): void {
    if (this.interval) {
      return;
    }
    void this.dispatchOnce().catch((err: unknown) => {
      console.error("agent-service outbox poll failed:", err);
    });
    this.interval = setInterval(
      () =>
        void this.dispatchOnce().catch((err: unknown) => {
          console.error("agent-service outbox poll failed:", err);
        }),
      this.options.pollIntervalMs,
    );
    this.interval.unref();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async dispatchOnce(): Promise<void> {
    if (this.polling) {
      return;
    }
    this.polling = true;
    try {
      const actions = await this.repository.claimBatch(
        this.options.batchSize,
        this.options.maxAttempts,
        this.options.lockTimeoutMs,
      );
      for (const action of actions) {
        const handler = this.handlers.get(action.actionType);
        if (!handler) {
          await this.repository.markFailed(
            action,
            `unknown action type: ${action.actionType}`,
            { retryAt: new Date().toISOString(), terminal: true },
          );
          continue;
        }

        try {
          await handler.handle(action, {
            idempotencyKey: action.id,
            attempt: action.attemptCount,
          });
          await this.repository.markProcessed(action);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const terminal =
            error instanceof PermanentActionError ||
            action.attemptCount >= this.options.maxAttempts;
          const backoff = Math.min(
            this.options.retryMaxMs,
            this.options.retryBaseMs *
              2 ** Math.max(0, action.attemptCount - 1),
          );
          await this.repository.markFailed(action, message, {
            retryAt: new Date(Date.now() + backoff).toISOString(),
            terminal,
          });
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
