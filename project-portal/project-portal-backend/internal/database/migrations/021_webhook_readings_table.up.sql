-- Create webhook_readings table for monitoring data ingested via webhooks
CREATE TABLE IF NOT EXISTS webhook_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    source_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(50),
    location JSONB,
    metadata JSONB,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for query performance
CREATE INDEX idx_webhook_readings_project_id ON webhook_readings(project_id);
CREATE INDEX idx_webhook_readings_metric_name ON webhook_readings(metric_name);
CREATE INDEX idx_webhook_readings_source ON webhook_readings(source);
CREATE INDEX idx_webhook_readings_captured_at ON webhook_readings(captured_at DESC);
CREATE INDEX idx_webhook_readings_webhook_id ON webhook_readings(webhook_id);

-- Convert to hypertable for time-series optimization (if TimescaleDB is enabled)
SELECT create_hypertable('webhook_readings', 'captured_at', if_not_exists => TRUE);