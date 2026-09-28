import type { AgentName } from "../types/agent.types.js";

export interface ApprovedAction {
  id: string;
  requestId: string;
  agent: AgentName;
  actionType: string;
  target: unknown | null;
  payload: unknown;
  reviewer: string | null;
  callingService: string | null;
  attemptCount: number;
}

export interface ActionHandlerContext {
  idempotencyKey: string;
  attempt: number;
}

export interface ApprovedActionHandler {
  handle(action: ApprovedAction, ctx: ActionHandlerContext): Promise<void>;
}

export interface ClaimedAction extends ApprovedAction {
  requestedBy: string;
}

export interface OutboxRepository {
  claimBatch(
    limit: number,
    maxAttempts: number,
    lockTimeoutMs: number,
  ): Promise<ClaimedAction[]>;
  markProcessed(action: ClaimedAction): Promise<void>;
  markFailed(
    action: ClaimedAction,
    error: string,
    options: { retryAt: string; terminal: boolean },
  ): Promise<void>;
}

export class PermanentActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentActionError";
  }
}
