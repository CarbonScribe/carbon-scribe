import { newDb } from "pg-mem";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateAuditLogSchema } from "../audit/audit-log.migrate.js";
import type { Queryable } from "../audit/audit-log.service.js";
import {
  ApprovalConflictError,
  ApprovalNotFoundError,
  ApprovalService,
} from "./approval.service.js";

function createTestService(): { service: ApprovalService; pool: Queryable } {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as Queryable;
  return { service: new ApprovalService(pool), pool };
}

describe("ApprovalService", () => {
  let service: ApprovalService;
  let pool: Queryable;

  beforeEach(async () => {
    const created = createTestService();
    service = created.service;
    pool = created.pool;
    await migrateAuditLogSchema(pool);
  });

  it("persists needs-approval results as pending and returns them in the queue", async () => {
    const runResult = {
      agent: "alert-triage" as const,
      requestId: "req-pending",
      status: "needs-approval" as const,
      output: { verdict: "escalate", reasoning: "Corroborated." },
      citations: [],
    };

    await service.queue(runResult, "project-portal", { projectId: "proj-7" });
    const [approval] = await service.listPending();

    expect(approval).toMatchObject({
      requestId: "req-pending",
      requestedBy: "project-portal",
      originalResult: runResult,
      originalInput: { projectId: "proj-7" },
      status: "pending",
      reviewer: null,
      decisionAt: null,
    });
  });

  it("audits approval and creates an approved action outbox entry atomically", async () => {
    const runResult = {
      agent: "alert-triage" as const,
      requestId: "req-approved",
      status: "needs-approval" as const,
      output: { verdict: "escalate", reasoning: "Corroborated." },
    };
    await service.queue(runResult, "project-portal", { projectId: "proj-8" });

    const approval = await service.decide(
      "req-approved",
      "approved",
      "reviewer-17",
      "project-portal",
    );
    expect(approval.reviewerCallingService).toBe("project-portal");
    const audit = await pool.query<{
      requested_by: string;
      actor: string;
      calling_service: string;
      status: string;
      request_id: string;
    }>(
      `SELECT request_id, requested_by, actor, calling_service, status FROM agent_audit_log
       WHERE request_id = $1 ORDER BY id DESC`,
      ["req-approved"],
    );
    const outbox = await pool.query<{
      request_id: string;
      action_type: string;
      status: string;
      payload: unknown;
      target: unknown;
      reviewer: string;
      reviewer_calling_service: string;
    }>(
      `SELECT request_id, action_type, status, payload, target, reviewer, reviewer_calling_service
       FROM agent_approved_action_outbox WHERE request_id = $1`,
      ["req-approved"],
    );

    expect(approval).toMatchObject({
      status: "approved",
      reviewer: "reviewer-17",
      actionType: "alert-triage.escalate",
    });
    expect(approval.decisionAt).toBeTruthy();
    expect(audit.rows[0]).toMatchObject({
      request_id: "req-approved",
      requested_by: "project-portal",
      actor: "reviewer-17",
      calling_service: "project-portal",
      status: "approved",
    });
    expect(outbox.rows[0]).toMatchObject({
      request_id: "req-approved",
      action_type: "alert-triage.escalate",
      status: "pending",
      payload: runResult,
      target: { projectId: "proj-8" },
      reviewer: "reviewer-17",
      reviewer_calling_service: "project-portal",
    });

    const actions = await pool.query(
      `SELECT request_id FROM agent_approved_action_outbox WHERE request_id = $1`,
      ["req-approved"],
    );
    expect(actions.rows).toHaveLength(1);
  });

  it("audits rejection without creating a downstream action", async () => {
    await service.queue(
      {
        agent: "compliance-report",
        requestId: "req-rejected",
        status: "needs-approval",
        output: { report: "draft" },
      },
      "corporate-platform",
      { reportId: "report-2" },
    );

    const approval = await service.decide(
      "req-rejected",
      "rejected",
      "reviewer-23",
      "corporate-platform",
    );
    const outbox = await pool.query(
      `SELECT request_id FROM agent_approved_action_outbox WHERE request_id = $1`,
      ["req-rejected"],
    );
    const audit = await pool.query<{
      status: string;
      requested_by: string;
      actor: string;
      calling_service: string;
    }>(
      `SELECT status, requested_by, actor, calling_service FROM agent_audit_log WHERE request_id = $1`,
      ["req-rejected"],
    );

    expect(approval.status).toBe("rejected");
    expect(approval.reviewerCallingService).toBe("corporate-platform");
    expect(outbox.rows).toHaveLength(0);
    expect(audit.rows[0]).toMatchObject({
      status: "rejected",
      requested_by: "corporate-platform",
      actor: "reviewer-23",
      calling_service: "corporate-platform",
    });
  });

  it("rejects unknown and already-decided requests", async () => {
    await expect(
      service.decide("missing", "approved", "reviewer-1", "project-portal"),
    ).rejects.toBeInstanceOf(ApprovalNotFoundError);

    await service.queue(
      {
        agent: "discovery",
        requestId: "req-once",
        status: "needs-approval",
        output: {},
      },
      "project-portal",
      { methodology: "forest" },
    );
    await service.decide(
      "req-once",
      "rejected",
      "reviewer-1",
      "project-portal",
    );
    await expect(
      service.decide("req-once", "approved", "reviewer-2", "project-portal"),
    ).rejects.toBeInstanceOf(ApprovalConflictError);
  });
});
