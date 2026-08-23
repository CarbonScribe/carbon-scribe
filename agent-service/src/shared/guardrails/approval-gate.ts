// Guardrail: any tool that would mutate state in corporate-platform or
// project-portal (retirement, tokenization, filing submission, etc.) must
// route through here rather than being called directly by an agent tool.
// For now this always returns "needs-approval" — no agent in this service
// is authorized to auto-execute a consequential action.
//
// TODO: define what "approved" actually means per action type (a human
// clicking approve in a UI? a second agent double-check? both?) before any
// agent tool is allowed to skip this gate.

export type ApprovalDecision = "needs-approval" | "auto-approved";

export interface ApprovalCheckInput {
  actionType: string;
  payload: unknown;
}

export function checkApproval(_input: ApprovalCheckInput): ApprovalDecision {
  return "needs-approval";
}
