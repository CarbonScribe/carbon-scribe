import type { AgentName } from "../types/agent.types.js";
import { getPool } from "./db.js";

/**
 * The slice of pg.Pool's interface this service actually uses — narrow on
 * purpose so a test can substitute a pg-mem-backed pool (or any other
 * query-capable stand-in) without needing to satisfy pg.Pool's full,
 * EventEmitter-based class shape.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface AgentAuditEntry {
  timestamp: string;
  agent: AgentName;
  requestId: string;
  requestedBy: string;
  /** Every tool call the agent made this run, in order. */
  toolCalls: Array<{ name: string; input: unknown }>;
  status: "drafted" | "needs-approval" | "failed";
}

// Persistent sink for agent-service's audit trail (issue #578).
//
// Sink decision: a dedicated table in agent-service's own Postgres
// database, not corporate-platform's audit-trail module. That module's
// AuditEvent model is hash-chained and scoped to (companyId, userId)
// behind a JWT-authenticated, per-company API — agent-service holds only
// an internal service token (no user JWT to forward), and at least one
// agent (pdd-draft) is triggered by project-portal-side callers that have
// no corporate-platform companyId at all. Routing through it would require
// a new internal ingestion endpoint that doesn't exist today and a
// companyId this service frequently can't supply. A dedicated table keyed
// on the fields this service actually has — requestId, agent name, and an
// opaque requestedBy string — is the honest fit; see
// migrations/001_create_agent_audit_log.sql for the schema and its own
// copy of this reasoning.
//
// Failure behavior: record() does not catch or swallow a write failure —
// a `pool.query` rejection (connection refused, pool exhausted, etc.)
// propagates to the caller as a rejected promise. An audit-log outage is a
// real operational problem and should surface as one (a 500 at the HTTP
// boundary via each agent route's existing error handler) rather than
// silently discarding the entry a caller believed was durably recorded.
export class AuditLogService {
  constructor(private readonly pool: Queryable = getPool()) {}

  async record(entry: AgentAuditEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_audit_log
         (request_id, agent, requested_by, status, tool_calls, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.requestId,
        entry.agent,
        entry.requestedBy,
        entry.status,
        JSON.stringify(entry.toolCalls),
        entry.timestamp,
      ],
    );
  }

  /**
   * Look up every audit entry recorded for a given requestId, oldest
   * first. Returns an empty array if nothing was ever recorded for it —
   * callers distinguish "no such run" from "run recorded, empty tool
   * calls" via array length, not a null/undefined sentinel.
   */
  async findByRequestId(requestId: string): Promise<AgentAuditEntry[]> {
    const result = await this.pool.query<{
      request_id: string;
      agent: AgentName;
      requested_by: string;
      status: AgentAuditEntry["status"];
      tool_calls: AgentAuditEntry["toolCalls"];
      occurred_at: Date;
    }>(
      `SELECT request_id, agent, requested_by, status, tool_calls, occurred_at
       FROM agent_audit_log
       WHERE request_id = $1
       ORDER BY occurred_at ASC, id ASC`,
      [requestId],
    );

    return result.rows.map((row) => ({
      timestamp: row.occurred_at.toISOString(),
      agent: row.agent,
      requestId: row.request_id,
      requestedBy: row.requested_by,
      toolCalls: row.tool_calls,
      status: row.status,
    }));
  }
}

export const auditLog = new AuditLogService();
