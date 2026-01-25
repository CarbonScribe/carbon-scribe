-- Migration: 013_health_tables
-- Description: Create tables for Health Checks module
-- Date: 2026-01-23

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- System metrics time-series hypertable
CREATE TABLE system_metrics (
    time TIMESTAMPTZ NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'gauge', 'counter', 'histogram', 'summary'
    
    -- Labels/dimensions for the metric
    service_name VARCHAR(100),
    endpoint VARCHAR(500),
    http_method VARCHAR(10),
    http_status_code INTEGER,
    instance_id VARCHAR(100),
    region VARCHAR(50),
    
    -- Metric values
    value DOUBLE PRECISION NOT NULL,
    count INTEGER, -- For histograms/summaries
    bucket_bounds DOUBLE PRECISION[], -- For histograms
    
    -- Additional metadata
    labels JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);
SELECT create_hypertable('system_metrics', 'time');
CREATE INDEX idx_system_metrics_name_time ON system_metrics (metric_name, time DESC);
CREATE INDEX idx_system_metrics_service ON system_metrics (service_name, time DESC);

-- Service health checks
CREATE TABLE service_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- 'http', 'tcp', 'database', 'custom'
    check_config JSONB NOT NULL, -- Type-specific configuration
    
    -- Scheduling
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_seconds INTEGER NOT NULL DEFAULT 10,
    
    -- Status
    last_check_time TIMESTAMPTZ,
    last_success_time TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    
    -- Alerting
    alert_on_failure BOOLEAN DEFAULT TRUE,
    alert_threshold_failures INTEGER DEFAULT 3,
    alert_severity VARCHAR(20) DEFAULT 'critical',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Health check results
CREATE TABLE health_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES service_health_checks(id) ON DELETE CASCADE,
    
    -- Execution details
    check_time TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    
    -- Result details
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    
    -- Metadata
    instance_id VARCHAR(100),
    region VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
SELECT create_hypertable('health_check_results', 'check_time');
CREATE INDEX idx_health_check_results_check ON health_check_results (check_id, check_time DESC);

-- System alerts
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(100) UNIQUE NOT NULL, -- External alert ID for deduplication
    
    -- Alert definition
    alert_name VARCHAR(255) NOT NULL,
    alert_severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    alert_source VARCHAR(100) NOT NULL, -- 'metric_threshold', 'health_check', 'manual'
    
    -- Affected resources
    service_name VARCHAR(100),
    metric_name VARCHAR(255),
    resource_id VARCHAR(255),
    
    -- Alert details
    description TEXT NOT NULL,
    condition JSONB NOT NULL, -- Condition that triggered the alert
    current_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    
    -- Status and lifecycle
    status VARCHAR(50) DEFAULT 'firing', -- 'firing', 'resolved', 'acknowledged', 'silenced'
    fired_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    
    -- Additional context
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_system_alerts_status ON system_alerts (status, fired_at);
CREATE INDEX idx_system_alerts_service ON system_alerts (service_name, fired_at DESC);

-- Service dependencies graph
CREATE TABLE service_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_service VARCHAR(100) NOT NULL,
    target_service VARCHAR(100) NOT NULL,
    dependency_type VARCHAR(50) NOT NULL, -- 'hard', 'soft', 'data'
    
    -- Health impact
    failure_impact VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    degradation_behavior VARCHAR(100), -- How source behaves when target fails
    
    -- Monitoring
    health_check_id UUID REFERENCES service_health_checks(id),
    is_monitored BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(source_service, target_service),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- System status snapshots (for reporting)
CREATE TABLE system_status_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_time TIMESTAMPTZ NOT NULL,
    snapshot_type VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly', 'incident'
    
    -- Status summary
    overall_status VARCHAR(20) NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
    services_total INTEGER NOT NULL,
    services_healthy INTEGER NOT NULL,
    services_degraded INTEGER NOT NULL,
    services_unhealthy INTEGER NOT NULL,
    
    -- Key metrics at snapshot time
    api_p99_response_time_ms DOUBLE PRECISION,
    db_connection_utilization_percent DOUBLE PRECISION,
    error_rate_percent DOUBLE PRECISION,
    active_users INTEGER,
    
    -- Active incidents
    active_critical_alerts INTEGER DEFAULT 0,
    active_warning_alerts INTEGER DEFAULT 0,
    
    -- Detailed status
    service_status JSONB NOT NULL, -- Per-service status details
    metric_summaries JSONB NOT NULL, -- Key metric summaries
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
SELECT create_hypertable('system_status_snapshots', 'snapshot_time');
CREATE INDEX idx_snapshots_type_time ON system_status_snapshots (snapshot_type, snapshot_time DESC);