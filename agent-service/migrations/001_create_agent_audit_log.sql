-- Migration: 001_create_agent_audit_log
-- Description: Durable store for agent-service's audit trail (issue #578).
-- Date: 2026-08-26
--
-- Dedicated table rather than corporate-platform's audit-trail module: that
-- module's AuditEvent model is hash-chained and keyed on (companyId,
-- userId) behind a JWT-authenticated, per-company API — agent-service has
-- no user JWT (only an internal service token) and several agents (e.g.
-- pdd-draft) are triggered by project-portal-side callers that have no
-- corporate-platform companyId at all. Pushing entries there would need a
-- new internal ingestion endpoint that doesn't exist and a companyId this
-- service frequently can't supply. A small dedicated table keyed on the
-- fields this service actually has (requestId, agent name, an opaque
-- requestedBy string) is the more honest fit; see
-- src/shared/audit/audit-log.service.ts for the full writeup.
--
-- Applied idempotently at service startup (see
-- src/shared/audit/audit-log.migrate.ts) rather than via a separate
-- migration-runner CLI, since this is presently agent-service's only
-- table.

CREATE TABLE IF NOT EXISTS agent_audit_log (
    id BIGSERIAL PRIMARY KEY,
    request_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL,
    tool_calls JSONB NOT NULL DEFAULT '[]',
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_request_id
    ON agent_audit_log (request_id);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_agent
    ON agent_audit_log (agent);
