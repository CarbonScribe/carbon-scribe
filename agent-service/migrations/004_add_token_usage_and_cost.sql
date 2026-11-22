-- Migration: 004_add_token_usage_and_cost
-- Description: Token usage, cache metrics, iterations, and cost attribution in audit log (issue #829).

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS iterations INTEGER;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS input_tokens INTEGER;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS cache_creation_input_tokens INTEGER;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS cache_read_input_tokens INTEGER;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

ALTER TABLE agent_audit_log
    ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 6);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_agent_occurred_at
    ON agent_audit_log (agent, occurred_at);

CREATE OR REPLACE VIEW agent_daily_token_usage AS
SELECT
    CAST(occurred_at AS DATE) AS day,
    agent,
    model,
    COUNT(*) AS run_count,
    SUM(COALESCE(input_tokens, 0)) AS total_input_tokens,
    SUM(COALESCE(output_tokens, 0)) AS total_output_tokens,
    SUM(COALESCE(cache_creation_input_tokens, 0)) AS total_cache_creation_input_tokens,
    SUM(COALESCE(cache_read_input_tokens, 0)) AS total_cache_read_input_tokens,
    SUM(COALESCE(total_tokens, 0)) AS total_tokens,
    SUM(COALESCE(estimated_cost_usd, 0.0)) AS total_estimated_cost_usd
FROM agent_audit_log
GROUP BY CAST(occurred_at AS DATE), agent, model;
