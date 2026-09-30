import { newDb } from "pg-mem";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateAuditLogSchema } from "../audit/audit-log.migrate.js";
import type { Queryable } from "../audit/audit-log.service.js";
import { ApprovalService } from "../approvals/approval.service.js";
import { PostgresOutboxRepository } from "./outbox.repository.js";
import type { ClaimedAction } from "./outbox.types.js";

function createAction(overrides: Partial<ClaimedAction> = {}): ClaimedAction {
  return {
    id: "",
    requestId: "req-audited-dispatch",
    agent: "alert-triage",
    actionType: "alert-triage.escalate",
    target: { projectId: "p-1" },
    payload: { status: "needs-approval" },
    reviewer: "reviewer-9",
    callingService: "project-portal",
    attemptCount: 1,
    requestedBy: "project-portal",
    ...overrides,
  };
}

describe("PostgresOutboxRepository audit", () => {
  let pool: Queryable;
  let repository: PostgresOutboxRepository;
  let action: ClaimedAction;

  beforeEach(async () => {
    const db = newDb();
    const { Pool } = db.adapters.createPg();
    pool = new Pool() as unknown as Queryable;
    await migrateAuditLogSchema(pool);
    const approvals = new ApprovalService(pool);
    await approvals.queue(
      {
        agent: "alert-triage",
        requestId: "req-audited-dispatch",
        status: "needs-approval",
        output: { verdict: "escalate" },
      },
      "project-portal",
      { projectId: "p-1" },
    );
    await approvals.decide(
      "req-audited-dispatch",
      "approved",
      "reviewer-9",
      "project-portal",
    );
    await pool.query(
      `UPDATE agent_approved_action_outbox SET status = 'processing' WHERE request_id = $1`,
      ["req-audited-dispatch"],
    );
    repository = new PostgresOutboxRepository(pool);
    const rows = await pool.query<{ id: string | number }>(
      `SELECT id FROM agent_approved_action_outbox WHERE request_id = $1`,
      ["req-audited-dispatch"],
    );
    action = createAction({ id: String(rows.rows[0]!.id) });
  });

  it("records successful dispatch linked to the original request", async () => {
    await repository.markProcessed(action);

    const rows = await pool.query<{
      request_id: string;
      requested_by: string;
      actor: string;
      calling_service: string;
      status: string;
      tool_calls: Array<{ input: { outboxId: string; outcome: string } }>;
    }>(
      `SELECT request_id, requested_by, actor, calling_service, status, tool_calls
       FROM agent_audit_log WHERE status = 'dispatch-processed'`,
    );
    const outbox = await pool.query<{ status: string }>(
      `SELECT status FROM agent_approved_action_outbox WHERE request_id = $1`,
      ["req-audited-dispatch"],
    );

    expect(rows.rows[0]).toMatchObject({
      request_id: "req-audited-dispatch",
      requested_by: "project-portal",
      actor: "reviewer-9",
      calling_service: "project-portal",
      status: "dispatch-processed",
    });
    expect(rows.rows[0]?.tool_calls[0]?.input).toMatchObject({
      outboxId: action.id,
      outcome: "processed",
    });
    expect(outbox.rows[0]?.status).toBe("processed");
  });

  it("records retry and terminal dispatch failures with last_error", async () => {
    await repository.markFailed(action, "temporary", {
      retryAt: new Date(Date.now() + 2000).toISOString(),
      terminal: false,
    });
    const pending = await pool.query<{ status: string; last_error: string }>(
      `SELECT status, last_error FROM agent_approved_action_outbox WHERE request_id = $1`,
      [action.requestId],
    );
    expect(pending.rows[0]).toEqual({
      status: "pending",
      last_error: "temporary",
    });

    await pool.query(
      `UPDATE agent_approved_action_outbox SET status = 'processing' WHERE request_id = $1`,
      [action.requestId],
    );
    await repository.markFailed(action, "permanent", {
      retryAt: new Date().toISOString(),
      terminal: true,
    });
    const failed = await pool.query<{ status: string; last_error: string }>(
      `SELECT status, last_error FROM agent_approved_action_outbox WHERE request_id = $1`,
      [action.requestId],
    );
    const audits = await pool.query<{
      status: string;
      requested_by: string;
      actor: string;
    }>(
      `SELECT status, requested_by, actor FROM agent_audit_log
       WHERE request_id = $1 ORDER BY id DESC LIMIT 2`,
      [action.requestId],
    );

    expect(failed.rows[0]).toEqual({
      status: "failed",
      last_error: "permanent",
    });
    expect(audits.rows.map((row) => row.status)).toEqual([
      "dispatch-failed",
      "dispatch-retry",
    ]);
    expect(audits.rows[0]).toMatchObject({
      requested_by: "project-portal",
      actor: "reviewer-9",
    });
  });
});
