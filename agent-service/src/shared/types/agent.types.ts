// Shared request/response contracts for every agent route in this service.
// Individual agents extend these rather than inventing their own shapes, so
// the audit log and guardrail middleware can stay agent-agnostic.

export type AgentName =
  "discovery" | "pdd-draft" | "compliance-report" | "alert-triage";

export interface AgentRunRequest {
  /** Caller-provided idempotency/trace id — propagate into the audit log. */
  requestId: string;
  /** Identity of the human or system that triggered this run. */
  requestedBy: string;
  input: unknown;
}

export interface AgentRunResult {
  agent: AgentName;
  requestId: string;
  /** Agents in this service draft or recommend — they do not execute
   * financial/on-chain actions. `status` reflects that a human approval
   * step is expected downstream for anything consequential. */
  status: "drafted" | "needs-approval" | "failed";
  output: unknown;
  /** Citations/source records the agent grounded its answer in — required
   * for anything compliance- or portfolio-facing. */
  citations?: AgentCitation[];
}

export interface AgentCitation {
  source: string;
  reference: string;
}
