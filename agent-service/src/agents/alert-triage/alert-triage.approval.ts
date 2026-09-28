import {
  classifyConfirmAlertError,
  projectPortalClient,
  type ConfirmAlertPayload,
  type ConfirmAlertResponse,
} from "../../clients/project-portal.client.js";
import type { ErrorCategory } from "../../llm/errors.js";
import {
  ALERT_TRIAGE_ACTION_TYPES,
  checkApproval,
} from "../../shared/guardrails/approval-gate.js";
import type { AgentRunResult } from "../../shared/types/agent.types.js";

// ---------------------------------------------------------------------------
// Alert-triage escalation approval
// ---------------------------------------------------------------------------
//
// An `escalate` verdict is a recommendation, not an action. approval-gate.ts
// resolves it to "needs-approval", and the agent run returns without touching
// project-portal — see alert-triage.agent.ts, which only classifies. This
// module is the other half of that split: the transition a reviewer's
// approval has to go through before the confirmed alert reaches
// project-portal's notification pipeline.
//
// The downstream call deliberately lives here rather than at the end of
// runAlertTriageAgent: pushing an escalation on run completion would raise an
// alert project-portal was never told to act on, and would leave a rejected
// escalation indistinguishable from an approved one. Until an approval
// queue/UI exists (tracked separately), nothing calls this automatically, but
// no escalation can reach project-portal without going through it.

export type AlertTriageVerdict = "escalate" | "suppress" | "needs-more-data";

/** A triage run a reviewer must sign off on before anything goes downstream. */
export interface PendingAlertTriageEscalation {
  /**
   * Project the candidate alert belongs to — required to address
   * project-portal (the agent's own output carries the verdict/reasoning, not
   * a project id, so the approval context is where this is kept).
   */
  projectId: string;
  /**
   * Who triggered the original triage run, if the approval queue kept it —
   * carried into the notification metadata for the audit trail.
   */
  requestedBy?: string;
  /** The needs-approval AgentRunResult the alert-triage agent produced. */
  result: AgentRunResult;
}

/** A reviewer's disposition of a pending escalation. */
export type AlertTriageApprovalDecision = "approved" | "rejected";

/**
 * Outcome of applying a reviewer's decision.
 *
 * `notified` is the only state in which the escalation is complete.
 * `notification-failed` is deliberately distinct from the agent run's own
 * `status: "failed"` and `errorCategory`: it means the triage run succeeded
 * and was approved, but the push to project-portal did not — so the escalation
 * must be retried/re-driven rather than treated as delivered or as a bad
 * triage.
 */
export type AlertTriageApprovalOutcome =
  | {
      /** suppress / needs-more-data: auto-approved by definition, never notifies. */
      status: "not-applicable";
      verdict: AlertTriageVerdict;
    }
  | { status: "rejected"; verdict: "escalate" }
  | {
      status: "notified";
      verdict: "escalate";
      notification: ConfirmAlertResponse;
    }
  | {
      status: "notification-failed";
      verdict: "escalate";
      /** Distinguishes a downstream push failure from an agent-run failure. */
      errorCategory: ErrorCategory;
      retryable: boolean;
      error: string;
    };

function verdictOf(result: AgentRunResult): AlertTriageVerdict {
  const verdict = (result.output as { verdict?: unknown } | null)?.verdict;
  if (
    verdict === "escalate" ||
    verdict === "suppress" ||
    verdict === "needs-more-data"
  ) {
    return verdict;
  }
  throw new Error(
    "Cannot apply an approval to an alert-triage result with no recognized " +
      `verdict (got ${JSON.stringify(verdict)}).`,
  );
}

function actionTypeFor(verdict: AlertTriageVerdict): string {
  switch (verdict) {
    case "escalate":
      return ALERT_TRIAGE_ACTION_TYPES.ESCALATE;
    case "suppress":
      return ALERT_TRIAGE_ACTION_TYPES.SUPPRESS;
    case "needs-more-data":
      return ALERT_TRIAGE_ACTION_TYPES.NEEDS_MORE_DATA;
  }
}

function reasoningOf(result: AgentRunResult): string {
  const reasoning = (result.output as { reasoning?: unknown } | null)
    ?.reasoning;
  return typeof reasoning === "string" ? reasoning : "";
}

/**
 * Apply a reviewer's decision to a pending alert-triage escalation.
 *
 * Re-runs the approval guardrail on the result rather than trusting the
 * caller: only `alert-triage.escalate` resolves to "needs-approval", so a
 * suppress / needs-more-data result returns `not-applicable` and never calls
 * project-portal even if a caller passes `"approved"`.
 *
 * When the escalation is approved, this pushes the confirmed alert via
 * {@link projectPortalClient.confirmAlert} and returns `notified` with the
 * created notification. If that push fails, the failure is surfaced as
 * `notification-failed` (with its own classification) instead of being
 * swallowed or mistaken for a completed escalation.
 */
export async function applyAlertTriageApproval(
  pending: PendingAlertTriageEscalation,
  decision: AlertTriageApprovalDecision,
): Promise<AlertTriageApprovalOutcome> {
  const verdict = verdictOf(pending.result);
  const actionType = actionTypeFor(verdict);

  const approval = checkApproval({
    actionType,
    payload: pending.result.output,
  });
  if (approval !== "needs-approval") {
    return { status: "not-applicable", verdict };
  }

  if (decision !== "approved") {
    return { status: "rejected", verdict: "escalate" };
  }

  const reasoning = reasoningOf(pending.result);
  const payload: ConfirmAlertPayload = {
    category: "monitoring.alert",
    subject: `Confirmed alert for project ${pending.projectId}`,
    content: reasoning,
    channels: ["IN_APP"],
    // Retried POSTs are de-duplicated by the backend on this key.
    idempotencyKey: pending.result.requestId,
    metadata: {
      verdict: "escalate",
      reasoning,
      requestId: pending.result.requestId,
      requestedBy: pending.requestedBy,
      citations: pending.result.citations ?? [],
    },
  };

  try {
    const notification = await projectPortalClient.confirmAlert(
      pending.projectId,
      payload,
    );
    return { status: "notified", verdict: "escalate", notification };
  } catch (err) {
    // Never resolve as `notified` here: the escalation is not complete until
    // project-portal has the alert. Surfacing the classification lets the
    // caller decide whether to retry the approval push.
    const { category, retryable } = classifyConfirmAlertError(err);
    return {
      status: "notification-failed",
      verdict: "escalate",
      error: err instanceof Error ? err.message : String(err),
      errorCategory: category,
      retryable,
    };
  }
}
