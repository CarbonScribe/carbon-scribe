import { env } from "../../config/env.js";
import { ALERT_TRIAGE_ACTION_TYPES } from "../guardrails/approval-gate.js";
import {
  AlertTriageEscalateHandler,
  LoggingEscalationNotifier,
} from "./alert-triage-escalate.handler.js";
import { ActionHandlerRegistry } from "./handler-registry.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";
import { outboxRepository } from "./outbox.repository.js";

export const actionHandlerRegistry = new ActionHandlerRegistry();
actionHandlerRegistry.register(
  ALERT_TRIAGE_ACTION_TYPES.ESCALATE,
  new AlertTriageEscalateHandler(new LoggingEscalationNotifier()),
);

export const outboxDispatcher = new OutboxDispatcher(
  outboxRepository,
  actionHandlerRegistry,
  {
    pollIntervalMs: env.approvalOutboxPollIntervalMs,
    batchSize: env.approvalOutboxBatchSize,
    maxAttempts: env.approvalOutboxMaxAttempts,
    lockTimeoutMs: env.approvalOutboxLockTimeoutMs,
    retryBaseMs: env.approvalOutboxRetryBaseMs,
    retryMaxMs: env.approvalOutboxRetryMaxMs,
  },
);
