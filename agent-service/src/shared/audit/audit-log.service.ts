import type { AgentName } from "../types/agent.types.js";

export interface AgentAuditEntry {
  timestamp: string;
  agent: AgentName;
  requestId: string;
  requestedBy: string;
  /** Every tool call the agent made this run, in order. */
  toolCalls: Array<{ name: string; input: unknown }>;
  status: "drafted" | "needs-approval" | "failed";
}

// TODO: this currently just logs to stdout. Replace with a real sink —
// either its own persistent store, or push into corporate-platform's
// existing audit-trail module (stellar-core/compliance-engine has an
// audit_trail contract too) so agent decisions live alongside the rest of
// the platform's compliance record instead of a separate silo.
export class AuditLogService {
  async record(entry: AgentAuditEntry): Promise<void> {
    console.log("[audit]", JSON.stringify(entry));
  }
}

export const auditLog = new AuditLogService();
