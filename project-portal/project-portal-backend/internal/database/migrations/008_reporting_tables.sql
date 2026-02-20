-- Migration: 008_reporting_tables
-- Description: Create tables for Reporting & Analytics module
-- Date: 2026-01-23

-- Report definitions and templates
CREATE TABLE IF NOT EXISTS report_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'financial', 'operational', 'compliance', 'custom'
    
    -- Report configuration (JSON schema)
    config JSONB NOT NULL, -- Includes dataset, fields, filters, groupings, sorts
    
    -- Access control
    created_by UUID,
    visibility VARCHAR(50) DEFAULT 'private', -- 'private', 'shared', 'public'
    shared_with_users UUID[], -- Array of user IDs
    shared_with_roles VARCHAR(50)[], -- Array of role names
    
    -- Versioning
    version INTEGER DEFAULT 1,
    is_template BOOLEAN DEFAULT FALSE,
    based_on_template_id UUID REFERENCES report_definitions(id),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled reports
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_definition_id UUID REFERENCES report_definitions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    
    -- Schedule configuration
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Output configuration
    format VARCHAR(20) NOT NULL, -- 'csv', 'excel', 'pdf', 'json'
    delivery_method VARCHAR(50) NOT NULL, -- 'email', 's3', 'webhook'
    delivery_config JSONB NOT NULL, -- Method-specific configuration
    
    -- Recipients
    recipient_emails TEXT[],
    recipient_user_ids UUID[],
    webhook_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Report execution history
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_definition_id UUID REFERENCES report_definitions(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
    triggered_by UUID,
    
    -- Execution details
    triggered_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    
    -- Results
    record_count INTEGER,
    file_size_bytes BIGINT,
    file_key VARCHAR(1000), -- S3 key or storage reference
    download_url TEXT, -- Temporary download URL
    delivery_status JSONB, -- Per-recipient delivery status
    
    parameters JSONB, -- Parameters used for this execution
    execution_log TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark datasets
CREATE TABLE IF NOT EXISTS benchmark_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'carbon_sequestration', 'revenue', 'cost_efficiency'
    methodology VARCHAR(100),
    region VARCHAR(100),
    
    -- Benchmark data (can be large, consider partitioning)
    data JSONB NOT NULL, -- Array of benchmark values with metadata
    year INTEGER NOT NULL,
    source VARCHAR(255), -- Source of benchmark data
    confidence_score DECIMAL(3,2),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard widget configurations
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    dashboard_section VARCHAR(100), -- 'overview', 'financial', 'operational'
    
    -- Widget configuration
    widget_type VARCHAR(50) NOT NULL, -- 'chart', 'metric', 'table', 'gauge'
    title VARCHAR(255) NOT NULL,
    config JSONB NOT NULL, -- Type-specific configuration
    size VARCHAR(20) DEFAULT 'medium', -- 'small', 'medium', 'large', 'full'
    position INTEGER, -- Order in dashboard
    
    refresh_interval_seconds INTEGER DEFAULT 300,
    last_refreshed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_report_definitions_created_by ON report_definitions(created_by);
CREATE INDEX IF NOT EXISTS idx_report_definitions_category ON report_definitions(category);
CREATE INDEX IF NOT EXISTS idx_report_definitions_visibility ON report_definitions(visibility);

CREATE INDEX IF NOT EXISTS idx_report_schedules_report_id ON report_schedules(report_definition_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_is_active ON report_schedules(is_active);

CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(report_definition_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_schedule_id ON report_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_triggered_at ON report_executions(triggered_at);

CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_category ON benchmark_datasets(category);
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_methodology ON benchmark_datasets(methodology);
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_region ON benchmark_datasets(region);
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_year ON benchmark_datasets(year);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user_id ON dashboard_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_section ON dashboard_widgets(dashboard_section);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_report_definitions_updated_at
    BEFORE UPDATE ON report_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_schedules_updated_at
    BEFORE UPDATE ON report_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_datasets_updated_at
    BEFORE UPDATE ON benchmark_datasets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
    BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
