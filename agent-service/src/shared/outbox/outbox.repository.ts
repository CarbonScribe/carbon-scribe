import type { AgentName } from "../types/agent.types.js";
import { getPool } from "../audit/db.js";
import type { Queryable } from "../audit/audit-log.service.js";
import type { ClaimedAction, OutboxRepository } from "./outbox.types.js";

interface OutboxRow {
  id: string | number;
  request_id: string;
  agent: AgentName;
  action_type: string;
  target: unknown | null;
  payload: unknown;
  reviewer: string | null;
  reviewer_calling_service: string | null;
  attempt_count: number;
  requested_by: string;
}

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly customPool?: Queryable) {}

  private get pool(): Queryable {
    return this.customPool ?? getPool();
  }

  async claimBatch(
    limit: number,
    maxAttempts: number,
    lockTimeoutMs: number,
  ): Promise<ClaimedAction[]> {
    const leaseCutoff = new Date(Date.now() - lockTimeoutMs).toISOString();
    await this.failExhaustedStaleRows(maxAttempts, leaseCutoff);

    const result = await this.pool.query<OutboxRow>(
      `WITH claimable AS (
         SELECT id
         FROM agent_approved_action_outbox
         WHERE attempt_count < $1
           AND (
             (status = 'pending' AND next_attempt_at <= now())
             OR (status = 'processing' AND locked_at < $2::timestamptz)
           )
         ORDER BY id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $3
       ), claimed AS (
         UPDATE agent_approved_action_outbox AS outbox
         SET status = 'processing', attempt_count = outbox.attempt_count + 1,
             locked_at = now()
         FROM claimable
         WHERE outbox.id = claimable.id
         RETURNING outbox.id, outbox.request_id, outbox.agent, outbox.action_type,
                   outbox.target, outbox.payload, outbox.reviewer,
                   outbox.reviewer_calling_service, outbox.attempt_count
       )
       SELECT claimed.*, approval.requested_by
       FROM claimed
       JOIN agent_approval_requests AS approval USING (request_id)
       ORDER BY claimed.id ASC`,
      [maxAttempts, leaseCutoff, limit],
    );

    return result.rows.map(toClaimedAction);
  }

  async markProcessed(action: ClaimedAction): Promise<void> {
    const result = await this.pool.query(
      `UPDATE agent_approved_action_outbox
       SET status = 'processed', processed_at = now(), locked_at = NULL,
           last_error = NULL
       WHERE id = $1 AND status = 'processing'
       RETURNING request_id, agent`,
      [action.id],
    );
    if (result.rows.length === 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO agent_audit_log
         (request_id, agent, requested_by, actor, calling_service, status, tool_calls, occurred_at)
       VALUES ($1, $2, $3, $4, $5, 'dispatch-processed', $6::jsonb, now())`,
      [
        action.requestId,
        action.agent,
        action.requestedBy,
        action.reviewer,
        action.callingService,
        JSON.stringify([
          {
            name: "outbox-dispatch",
            input: {
              outboxId: action.id,
              actionType: action.actionType,
              attempt: action.attemptCount,
              outcome: "processed",
            },
          },
        ]),
      ],
    );
  }

  async markFailed(
    action: ClaimedAction,
    error: string,
    options: { retryAt: string; terminal: boolean },
  ): Promise<void> {
    const auditStatus = options.terminal ? "dispatch-failed" : "dispatch-retry";
    const result = await this.pool.query(
      `UPDATE agent_approved_action_outbox
       SET status = CASE WHEN $4 THEN 'failed' ELSE 'pending' END,
           last_error = $2, next_attempt_at = $3::timestamptz, locked_at = NULL
       WHERE id = $1 AND status = 'processing'
       RETURNING request_id, agent`,
      [action.id, error, options.retryAt, options.terminal],
    );
    if (result.rows.length === 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO agent_audit_log
         (request_id, agent, requested_by, actor, calling_service, status, tool_calls, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
      [
        action.requestId,
        action.agent,
        action.requestedBy,
        action.reviewer,
        action.callingService,
        auditStatus,
        JSON.stringify([
          {
            name: "outbox-dispatch",
            input: {
              outboxId: action.id,
              actionType: action.actionType,
              attempt: action.attemptCount,
              outcome: auditStatus,
              error,
            },
          },
        ]),
      ],
    );
  }

  private async failExhaustedStaleRows(
    maxAttempts: number,
    leaseCutoff: string,
  ): Promise<void> {
    const expired = await this.pool.query<{
      request_id: string;
      agent: AgentName;
      action_type: string;
      attempt_count: number;
      last_error: string;
    }>(
      `WITH expired AS (
         UPDATE agent_approved_action_outbox
         SET status = 'failed', locked_at = NULL,
             last_error = COALESCE(last_error, 'maximum attempts exhausted after processing lease expired')
         WHERE status = 'processing' AND attempt_count >= $1
           AND locked_at < $2::timestamptz
         RETURNING request_id, agent, action_type, attempt_count, last_error
       ) SELECT * FROM expired`,
      [maxAttempts, leaseCutoff],
    );
    for (const row of expired.rows) {
      const approval = await this.pool.query<{
        requested_by: string;
        reviewer: string | null;
        reviewer_calling_service: string | null;
      }>(
        `SELECT requested_by, reviewer, reviewer_calling_service
         FROM agent_approval_requests WHERE request_id = $1`,
        [row.request_id],
      );
      const context = approval.rows[0];
      if (!context) {
        continue;
      }
      await this.pool.query(
        `INSERT INTO agent_audit_log
           (request_id, agent, requested_by, actor, calling_service, status, tool_calls, occurred_at)
         VALUES ($1, $2, $3, $4, $5, 'dispatch-failed', $6::jsonb, now())`,
        [
          row.request_id,
          row.agent,
          context.requested_by,
          context.reviewer,
          context.reviewer_calling_service,
          JSON.stringify([
            {
              name: "outbox-dispatch",
              input: {
                actionType: row.action_type,
                attempt: row.attempt_count,
                outcome: "dispatch-failed",
                error: row.last_error,
              },
            },
          ]),
        ],
      );
    }
  }
}

function toClaimedAction(row: OutboxRow): ClaimedAction {
  return {
    id: String(row.id),
    requestId: row.request_id,
    agent: row.agent,
    actionType: row.action_type,
    target: row.target,
    payload: row.payload,
    reviewer: row.reviewer,
    callingService: row.reviewer_calling_service,
    attemptCount: row.attempt_count,
    requestedBy: row.requested_by,
  };
}

export const outboxRepository = new PostgresOutboxRepository();
