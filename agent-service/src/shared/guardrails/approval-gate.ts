// Guardrail: the disposition of every agent-drafted result — whether it can
// flow back to the caller on its own ("auto-approved") or must wait for a
// human sign-off ("needs-approval") — is decided here, not by each agent
// improvising its own answer. All four agents in this service call
// checkApproval as the last step before producing their AgentRunResult.
//
// Design decision (resolves the file's former open TODO): "approved" means
// a human explicitly approving via whatever UI/queue consumes a
// "needs-approval" AgentRunResult — not a second agent double-check. This
// service only drafts and recommends; it never calls out to mutate
// corporate-platform/project-portal state itself, so an action type here
// describes the *kind of result* an agent is about to return, not a
// permission to execute something.
//
// Read-only / no-side-effect results (auto-approved): producing them commits
// nothing — no credit is reserved, nothing is registered, no notification is
// sent.
//   - discovery.recommend-credits: a marketplace search + shortlist.
//   - pdd-draft.draft-sections: drafts PDD text. An actual PDD submission is
//     a separate, not-yet-built flow that would define its own action type.
//   - alert-triage.suppress / alert-triage.needs-more-data: the "nothing
//     happens" outcomes of triage — neither notifies anyone.
//
// Consequential / regulatory-facing results (always needs-approval):
//   - compliance-report.draft-report: feeds a real regulatory filing. Always
//     needs-approval regardless of payload — enforced by the blocklist
//     below running before the allowlist, not merely by omission from it,
//     and covered by a dedicated test iterating every entry in
//     COMPLIANCE_REPORT_ACTION_TYPES.
//   - alert-triage.escalate: triggers project-portal's notification
//     pipeline — a real downstream effect, not just a decision.
//
// Any action type not explicitly recognized defaults to needs-approval —
// fail safe, not fail open, including for a typo'd or future action type
// nobody has classified yet.

export type ApprovalDecision = "needs-approval" | "auto-approved";

export interface ApprovalCheckInput {
  actionType: string;
  payload: unknown;
}

export const DISCOVERY_ACTION_TYPES = {
  RECOMMEND_CREDITS: "discovery.recommend-credits",
} as const;

export const PDD_DRAFT_ACTION_TYPES = {
  DRAFT_SECTIONS: "pdd-draft.draft-sections",
} as const;

/** Every compliance-report action type — all of them always need approval. */
export const COMPLIANCE_REPORT_ACTION_TYPES = {
  DRAFT_REPORT: "compliance-report.draft-report",
} as const;

export const ALERT_TRIAGE_ACTION_TYPES = {
  SUPPRESS: "alert-triage.suppress",
  NEEDS_MORE_DATA: "alert-triage.needs-more-data",
  ESCALATE: "alert-triage.escalate",
} as const;

// Checked first and wins over the allowlist below, so an action type here
// can never resolve to "auto-approved" even if it were also (mistakenly)
// added to AUTO_APPROVABLE_ACTION_TYPES in a future edit.
const ALWAYS_NEEDS_APPROVAL_ACTION_TYPES = new Set<string>([
  ...Object.values(COMPLIANCE_REPORT_ACTION_TYPES),
  ALERT_TRIAGE_ACTION_TYPES.ESCALATE,
]);

const AUTO_APPROVABLE_ACTION_TYPES = new Set<string>([
  DISCOVERY_ACTION_TYPES.RECOMMEND_CREDITS,
  PDD_DRAFT_ACTION_TYPES.DRAFT_SECTIONS,
  ALERT_TRIAGE_ACTION_TYPES.SUPPRESS,
  ALERT_TRIAGE_ACTION_TYPES.NEEDS_MORE_DATA,
]);

export function checkApproval(input: ApprovalCheckInput): ApprovalDecision {
  if (ALWAYS_NEEDS_APPROVAL_ACTION_TYPES.has(input.actionType)) {
    return "needs-approval";
  }
  if (AUTO_APPROVABLE_ACTION_TYPES.has(input.actionType)) {
    return "auto-approved";
  }
  return "needs-approval";
}
