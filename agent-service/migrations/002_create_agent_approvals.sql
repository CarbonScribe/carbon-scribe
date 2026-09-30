-- Durable human-approval queue and downstream action outbox (issue #630).

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS actor TEXT;

CREATE TABLE IF NOT EXISTS agent_approval_requests (
    request_id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    action_type TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    original_result JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer TEXT,
    decision_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (status = 'pending' AND reviewer IS NULL AND decision_at IS NULL)
        OR (status <> 'pending' AND reviewer IS NOT NULL AND decision_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_agent_approval_requests_status_created
    ON agent_approval_requests (status, created_at);

CREATE TABLE IF NOT EXISTS agent_approved_action_outbox (
    id BIGSERIAL NOT NULL UNIQUE,
    request_id TEXT PRIMARY KEY REFERENCES agent_approval_requests (request_id),
    agent TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CONSTRAINT agent_approved_action_outbox_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_approved_action_outbox_status_created
    ON agent_approved_action_outbox (status, created_at);