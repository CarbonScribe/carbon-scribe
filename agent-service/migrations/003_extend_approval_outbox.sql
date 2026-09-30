-- Approval input snapshots, dispatch metadata, retry state, and dispatch audit context.

ALTER TABLE agent_approval_requests
    ADD COLUMN IF NOT EXISTS original_input JSONB;
ALTER TABLE agent_approval_requests
    ADD COLUMN IF NOT EXISTS reviewer_calling_service TEXT;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS calling_service TEXT;

ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS target JSONB;
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS reviewer TEXT;
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS reviewer_calling_service TEXT;
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE agent_approved_action_outbox
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

UPDATE agent_approved_action_outbox SET status = 'processed' WHERE status = 'completed';

ALTER TABLE agent_approved_action_outbox
    DROP CONSTRAINT IF EXISTS agent_approved_action_outbox_status_check;
ALTER TABLE agent_approved_action_outbox
    ADD CONSTRAINT agent_approved_action_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'processed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_approved_action_outbox_id
    ON agent_approved_action_outbox (id);
CREATE INDEX IF NOT EXISTS idx_agent_approved_action_outbox_dispatch
    ON agent_approved_action_outbox (status, next_attempt_at, id);