import type {
  ActionHandlerContext,
  ApprovedAction,
  ApprovedActionHandler,
} from "./outbox.types.js";
import { PermanentActionError } from "./outbox.types.js";

export interface EscalationNotifier {
  notify(
    target: unknown,
    context: { requestId: string; idempotencyKey: string },
  ): Promise<void>;
}

export class LoggingEscalationNotifier implements EscalationNotifier {
  async notify(
    target: unknown,
    context: { requestId: string; idempotencyKey: string },
  ): Promise<void> {
    console.info(
      JSON.stringify({
        event: "approved-alert-triage-escalation",
        requestId: context.requestId,
        idempotencyKey: context.idempotencyKey,
        target,
      }),
    );
  }
}

export class AlertTriageEscalateHandler implements ApprovedActionHandler {
  constructor(private readonly notifier: EscalationNotifier) {}

  async handle(
    action: ApprovedAction,
    ctx: ActionHandlerContext,
  ): Promise<void> {
    if (action.target === null || action.target === undefined) {
      throw new PermanentActionError(
        "alert-triage.escalate cannot dispatch: original input snapshot is null",
      );
    }
    await this.notifier.notify(action.target, {
      requestId: action.requestId,
      idempotencyKey: ctx.idempotencyKey,
    });
  }
}

// TODO(issue escalation-wiring): replace the logging notifier when the
// project-portal escalation integration and target mapping are defined.
