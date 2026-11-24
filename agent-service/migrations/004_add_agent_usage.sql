ALTER TABLE agent_audit_log
  ADD COLUMN IF NOT EXISTS transport_request_id TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iterations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(14,8),
  ADD COLUMN IF NOT EXISTS error_category TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_usage_day
  ON agent_audit_log ((occurred_at::date), agent);

CREATE OR REPLACE VIEW agent_usage_by_agent_day AS
SELECT
  occurred_at::date AS usage_day,
  agent,
  COUNT(*) AS runs,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(cache_creation_input_tokens) AS cache_creation_input_tokens,
  SUM(cache_read_input_tokens) AS cache_read_input_tokens,
  SUM(cumulative_tokens) AS cumulative_tokens,
  SUM(iterations) AS iterations,
  SUM(COALESCE(estimated_cost_usd, 0)) AS estimated_cost_usd
FROM agent_audit_log
GROUP BY occurred_at::date, agent;
