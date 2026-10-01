import type { AgentRunResult } from "../types/agent.types.js";
import { getPool } from "../audit/db.js";
import type { Queryable } from "../audit/audit-log.service.js";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRecord {
  requestId: string;
  agent: AgentRunResult["agent"];
  actionType: string;
  requestedBy: string;
  originalResult: AgentRunResult;
  status: ApprovalStatus;
  reviewer: string | null;
  reviewerCallingService: string | null;
  originalInput: unknown | null;
  decisionAt: string | null;
  createdAt: string;
}

function actionTypeFor(result: AgentRunResult): string {
  const output = result.output;
  if (
    result.agent === "alert-triage" &&
    typeof output === "object" &&
    output !== null &&
    "verdict" in output &&
    output.verdict === "escalate"
  ) {
    return "alert-triage.escalate";
  }
  if (result.agent === "compliance-report") {
    return "compliance-report.draft-report";
  }
  return `${result.agent}.approved-result`;
}

export class ApprovalNotFoundError extends Error {
  constructor() {
    super("approval request not found");
  }
}

export class ApprovalConflictError extends Error {
  constructor(status: ApprovalStatus) {
    super(`approval request is already ${status}`);
  }
}

export class ApprovalService {
  constructor(private readonly customPool?: Queryable) {}

  private get pool(): Queryable {
    return this.customPool ?? getPool();
  }

  async queue(
    result: AgentRunResult,
    requestedBy: string,
    originalInput: unknown,
  ): Promise<void> {
    if (result.status !== "needs-approval") {
      return;
    }

    await this.pool.query(
      `INSERT INTO agent_approval_requests
         (request_id, agent, action_type, requested_by, original_result, original_input, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (request_id) DO NOTHING`,
      [
        result.requestId,
        result.agent,
        actionTypeFor(result),
        requestedBy,
        JSON.stringify(result),
        JSON.stringify(originalInput),
      ],
    );
  }

  async listPending(): Promise<ApprovalRecord[]> {
    const result = await this.pool.query<ApprovalRow>(
      `SELECT request_id, agent, action_type, requested_by, original_result, original_input, status,
              reviewer, reviewer_calling_service, decision_at, created_at
       FROM agent_approval_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC, request_id ASC`,
    );
    return result.rows.map(toApprovalRecord);
  }

  async decide(
    requestId: string,
    decision: Exclude<ApprovalStatus, "pending">,
    reviewer: string,
    callingService: string,
  ): Promise<ApprovalRecord> {
    const timestamp = new Date().toISOString();
    const result = await this.pool.query<ApprovalRow>(
      `WITH decided AS (
         UPDATE agent_approval_requests
         SET status = $2, reviewer = $3, reviewer_calling_service = $4,
           decision_at = $5::timestamptz
         WHERE request_id = $1 AND status = 'pending'
         RETURNING request_id, agent, action_type, requested_by, original_result,
                   original_input, status, reviewer, reviewer_calling_service, decision_at, created_at
       ), decision_audit AS (
         INSERT INTO agent_audit_log
           (request_id, agent, requested_by, actor, calling_service, status, tool_calls, occurred_at)
         SELECT request_id, agent, requested_by, $3, $4, $2, '[]'::jsonb, $5::timestamptz
         FROM decided
       ), action_outbox AS (
         INSERT INTO agent_approved_action_outbox
           (request_id, agent, action_type, payload, target, reviewer, reviewer_calling_service)
         SELECT request_id, agent, action_type, original_result, original_input, reviewer, reviewer_calling_service
         FROM decided
         WHERE status = 'approved'
       )
      SELECT request_id, agent, action_type, requested_by, original_result,
              original_input, status, reviewer, reviewer_calling_service,
              decision_at, created_at
       FROM decided`,
      [requestId, decision, reviewer, callingService, timestamp],
    );

    const row = result.rows[0];
    if (row) {
      return toApprovalRecord(row);
    }

    const existing = await this.pool.query<{ status: ApprovalStatus }>(
      `SELECT status FROM agent_approval_requests WHERE request_id = $1`,
      [requestId],
    );
    if (!existing.rows[0]) {
      throw new ApprovalNotFoundError();
    }
    throw new ApprovalConflictError(existing.rows[0].status);
  }
}

interface ApprovalRow {
  request_id: string;
  agent: AgentRunResult["agent"];
  action_type: string;
  requested_by: string;
  original_result: AgentRunResult;
  original_input: unknown | null;
  status: ApprovalStatus;
  reviewer: string | null;
  reviewer_calling_service: string | null;
  decision_at: Date | null;
  created_at: Date;
}

function toApprovalRecord(row: ApprovalRow): ApprovalRecord {
  return {
    requestId: row.request_id,
    agent: row.agent,
    actionType: row.action_type,
    requestedBy: row.requested_by,
    originalResult: row.original_result,
    status: row.status,
    reviewer: row.reviewer,
    reviewerCallingService: row.reviewer_calling_service,
    originalInput: row.original_input,
    decisionAt: row.decision_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export const approvalService = new ApprovalService();
