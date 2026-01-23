-- Migration: 012_reporting_tables.sql
-- Description: Creates tables for the Reporting & Analytics API
-- Author: CarbonScribe Team
-- Date: 2026-01-23

-- =====================================================
-- Report Definitions and Templates
-- =====================================================
CREATE TABLE IF NOT EXISTS report_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'financial', 'operational', 'compliance', 'custom'
    
    -- Report configuration (JSON schema)
    config JSONB NOT NULL, -- Includes dataset, fields, filters, groupings, sorts
    
    -- Access control
    created_by UUID REFERENCES users(id),
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

-- Index for faster queries
CREATE INDEX idx_report_definitions_created_by ON report_definitions(created_by);
CREATE INDEX idx_report_definitions_category ON report_definitions(category);
CREATE INDEX idx_report_definitions_visibility ON report_definitions(visibility);
CREATE INDEX idx_report_definitions_is_template ON report_definitions(is_template);

-- =====================================================
-- Scheduled Reports
-- =====================================================
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    
    -- Schedule configuration
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Output configuration
    format VARCHAR(20) NOT NULL, -- 'csv', 'excel', 'pdf', 'json'
    delivery_method VARCHAR(50) NOT NULL, -- 'email', 's3', 'webhook', 'notification'
    delivery_config JSONB NOT NULL, -- Method-specific configuration
    
    -- Recipients
    recipient_emails TEXT[],
    recipient_user_ids UUID[],
    webhook_url TEXT,
    
    -- Execution tracking
    last_executed_at TIMESTAMPTZ,
    next_execution_at TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for scheduler queries
CREATE INDEX idx_report_schedules_definition ON report_schedules(report_definition_id);
CREATE INDEX idx_report_schedules_active ON report_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_report_schedules_next_execution ON report_schedules(next_execution_at) WHERE is_active = TRUE;

-- =====================================================
-- Report Execution History
-- =====================================================
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
    triggered_by UUID REFERENCES users(id),
    
    -- Execution details
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    error_message TEXT,
    
    -- Results
    record_count INTEGER,
    file_size_bytes BIGINT,
    file_key VARCHAR(1000), -- S3 key or storage reference
    download_url TEXT, -- Temporary download URL
    download_url_expires_at TIMESTAMPTZ,
    delivery_status JSONB, -- Per-recipient delivery status
    
    -- Execution metadata
    parameters JSONB, -- Parameters used for this execution
    execution_log TEXT,
    duration_ms INTEGER, -- Execution duration in milliseconds
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for execution history queries
CREATE INDEX idx_report_executions_definition ON report_executions(report_definition_id);
CREATE INDEX idx_report_executions_schedule ON report_executions(schedule_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);
CREATE INDEX idx_report_executions_triggered_at ON report_executions(triggered_at DESC);
CREATE INDEX idx_report_executions_triggered_by ON report_executions(triggered_by);

-- =====================================================
-- Benchmark Datasets
-- =====================================================
CREATE TABLE IF NOT EXISTS benchmark_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'carbon_sequestration', 'revenue', 'cost_efficiency', 'verification_time'
    methodology VARCHAR(100),
    region VARCHAR(100),
    
    -- Benchmark data
    data JSONB NOT NULL, -- Array of benchmark values with metadata
    statistics JSONB, -- Pre-calculated statistics (mean, median, percentiles)
    year INTEGER NOT NULL,
    quarter INTEGER, -- Optional: 1, 2, 3, 4
    source VARCHAR(255), -- Source of benchmark data
    source_url TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Metadata
    sample_size INTEGER,
    data_collection_method VARCHAR(255),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for benchmark queries
CREATE INDEX idx_benchmark_datasets_category ON benchmark_datasets(category);
CREATE INDEX idx_benchmark_datasets_methodology ON benchmark_datasets(methodology);
CREATE INDEX idx_benchmark_datasets_region ON benchmark_datasets(region);
CREATE INDEX idx_benchmark_datasets_year ON benchmark_datasets(year DESC);
CREATE INDEX idx_benchmark_datasets_active ON benchmark_datasets(is_active) WHERE is_active = TRUE;

-- =====================================================
-- Dashboard Widgets Configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dashboard_section VARCHAR(100) NOT NULL, -- 'overview', 'financial', 'operational', 'compliance'
    
    -- Widget configuration
    widget_type VARCHAR(50) NOT NULL, -- 'chart', 'metric', 'table', 'gauge', 'map', 'timeline'
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    config JSONB NOT NULL, -- Type-specific configuration (data source, colors, thresholds, etc.)
    
    -- Layout
    size VARCHAR(20) DEFAULT 'medium', -- 'small', 'medium', 'large', 'full'
    position INTEGER NOT NULL, -- Order in dashboard section
    row_span INTEGER DEFAULT 1,
    col_span INTEGER DEFAULT 1,
    
    -- Data refresh
    refresh_interval_seconds INTEGER DEFAULT 300,
    last_refreshed_at TIMESTAMPTZ,
    cached_data JSONB, -- Cached widget data for fast loading
    
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for dashboard queries
CREATE INDEX idx_dashboard_widgets_user ON dashboard_widgets(user_id);
CREATE INDEX idx_dashboard_widgets_section ON dashboard_widgets(dashboard_section);
CREATE INDEX idx_dashboard_widgets_position ON dashboard_widgets(user_id, dashboard_section, position);

-- =====================================================
-- Dashboard Aggregates (Materialized Views Cache)
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_key VARCHAR(255) NOT NULL UNIQUE, -- Unique key for this aggregate
    aggregate_type VARCHAR(100) NOT NULL, -- 'project_summary', 'credit_totals', 'revenue_summary', etc.
    
    -- Scope
    project_id UUID,
    user_id UUID,
    organization_id UUID,
    
    -- Time period
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all_time'
    period_start DATE,
    period_end DATE,
    
    -- Aggregated data
    data JSONB NOT NULL,
    
    -- Metadata
    source_record_count INTEGER,
    last_source_update_at TIMESTAMPTZ, -- When source data was last updated
    computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_stale BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for aggregate lookups
CREATE INDEX idx_dashboard_aggregates_key ON dashboard_aggregates(aggregate_key);
CREATE INDEX idx_dashboard_aggregates_type ON dashboard_aggregates(aggregate_type);
CREATE INDEX idx_dashboard_aggregates_project ON dashboard_aggregates(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_dashboard_aggregates_user ON dashboard_aggregates(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_dashboard_aggregates_stale ON dashboard_aggregates(is_stale) WHERE is_stale = TRUE;

-- =====================================================
-- Report Data Sources (Available Datasets)
-- =====================================================
CREATE TABLE IF NOT EXISTS report_data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Schema information
    schema_definition JSONB NOT NULL, -- Available fields, types, relationships
    
    -- Source configuration
    source_type VARCHAR(50) NOT NULL, -- 'table', 'view', 'query', 'api'
    source_config JSONB NOT NULL, -- Connection/query details
    
    -- Access control
    required_permissions VARCHAR(50)[], -- Permissions needed to access this data source
    
    -- Performance hints
    supports_streaming BOOLEAN DEFAULT FALSE,
    max_records INTEGER, -- Maximum records that can be queried
    estimated_row_count BIGINT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default data sources
INSERT INTO report_data_sources (name, display_name, description, schema_definition, source_type, source_config, required_permissions, supports_streaming)
VALUES 
    ('projects', 'Carbon Projects', 'Project information including status, location, and methodology', 
     '{"fields": [{"name": "id", "type": "uuid", "label": "Project ID"}, {"name": "name", "type": "string", "label": "Project Name"}, {"name": "status", "type": "string", "label": "Status"}, {"name": "methodology", "type": "string", "label": "Methodology"}, {"name": "region", "type": "string", "label": "Region"}, {"name": "country", "type": "string", "label": "Country"}, {"name": "total_area_hectares", "type": "number", "label": "Total Area (ha)"}, {"name": "created_at", "type": "timestamp", "label": "Created Date"}]}',
     'table', '{"table": "projects"}', ARRAY['reports:read'], true),
     
    ('carbon_credits', 'Carbon Credits', 'Credit issuance and status information',
     '{"fields": [{"name": "id", "type": "uuid", "label": "Credit ID"}, {"name": "project_id", "type": "uuid", "label": "Project ID"}, {"name": "vintage_year", "type": "integer", "label": "Vintage Year"}, {"name": "calculated_tons", "type": "number", "label": "Calculated Tons"}, {"name": "issued_tons", "type": "number", "label": "Issued Tons"}, {"name": "status", "type": "string", "label": "Status"}, {"name": "minted_at", "type": "timestamp", "label": "Minted Date"}]}',
     'table', '{"table": "carbon_credits"}', ARRAY['reports:read'], true),
     
    ('monitoring_data', 'Monitoring Data', 'Satellite and IoT monitoring metrics',
     '{"fields": [{"name": "id", "type": "uuid", "label": "Record ID"}, {"name": "project_id", "type": "uuid", "label": "Project ID"}, {"name": "metric_type", "type": "string", "label": "Metric Type"}, {"name": "value", "type": "number", "label": "Value"}, {"name": "recorded_at", "type": "timestamp", "label": "Recorded Date"}, {"name": "source", "type": "string", "label": "Data Source"}]}',
     'table', '{"table": "monitoring_metrics"}', ARRAY['reports:read'], true),
     
    ('revenue_transactions', 'Revenue & Transactions', 'Financial transactions and revenue data',
     '{"fields": [{"name": "id", "type": "uuid", "label": "Transaction ID"}, {"name": "project_id", "type": "uuid", "label": "Project ID"}, {"name": "amount", "type": "number", "label": "Amount"}, {"name": "currency", "type": "string", "label": "Currency"}, {"name": "transaction_type", "type": "string", "label": "Type"}, {"name": "status", "type": "string", "label": "Status"}, {"name": "created_at", "type": "timestamp", "label": "Date"}]}',
     'table', '{"table": "payment_transactions"}', ARRAY['reports:read', 'finance:read'], true),
     
    ('forward_sales', 'Forward Sales', 'Forward sale agreements and status',
     '{"fields": [{"name": "id", "type": "uuid", "label": "Agreement ID"}, {"name": "project_id", "type": "uuid", "label": "Project ID"}, {"name": "buyer_id", "type": "uuid", "label": "Buyer ID"}, {"name": "tons_committed", "type": "number", "label": "Tons Committed"}, {"name": "price_per_ton", "type": "number", "label": "Price/Ton"}, {"name": "total_amount", "type": "number", "label": "Total Amount"}, {"name": "status", "type": "string", "label": "Status"}, {"name": "delivery_date", "type": "date", "label": "Delivery Date"}]}',
     'table', '{"table": "forward_sale_agreements"}', ARRAY['reports:read', 'finance:read'], true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reporting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trigger_report_definitions_updated_at
    BEFORE UPDATE ON report_definitions
    FOR EACH ROW EXECUTE FUNCTION update_reporting_updated_at();

CREATE TRIGGER trigger_report_schedules_updated_at
    BEFORE UPDATE ON report_schedules
    FOR EACH ROW EXECUTE FUNCTION update_reporting_updated_at();

CREATE TRIGGER trigger_benchmark_datasets_updated_at
    BEFORE UPDATE ON benchmark_datasets
    FOR EACH ROW EXECUTE FUNCTION update_reporting_updated_at();

CREATE TRIGGER trigger_dashboard_widgets_updated_at
    BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION update_reporting_updated_at();

CREATE TRIGGER trigger_dashboard_aggregates_updated_at
    BEFORE UPDATE ON dashboard_aggregates
    FOR EACH ROW EXECUTE FUNCTION update_reporting_updated_at();

-- Function to calculate next execution time
CREATE OR REPLACE FUNCTION calculate_next_execution(
    cron_expr VARCHAR,
    tz VARCHAR DEFAULT 'UTC',
    from_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    -- Simplified next execution calculation
    -- In production, use a proper cron parser extension
    next_time TIMESTAMPTZ;
BEGIN
    -- Default to 1 hour from now if cron parsing not available
    next_time := from_time + INTERVAL '1 hour';
    RETURN next_time AT TIME ZONE tz;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Insert sample benchmark data
-- =====================================================
INSERT INTO benchmark_datasets (name, category, methodology, region, year, data, statistics, source, confidence_score, sample_size, is_active)
VALUES 
    ('Agroforestry Carbon Sequestration 2025 - Africa', 'carbon_sequestration', 'VM0007', 'Africa', 2025,
     '{"values": [3.2, 4.1, 3.8, 5.2, 4.5, 3.9, 4.7, 5.1, 4.3, 3.6], "unit": "tCO2e/ha/year", "methodology": "VM0007"}',
     '{"mean": 4.24, "median": 4.2, "std_dev": 0.65, "min": 3.2, "max": 5.2, "p25": 3.8, "p75": 4.7, "p90": 5.1}',
     'Verra Registry Analysis', 0.85, 156, true),
     
    ('Improved Forest Management 2025 - Southeast Asia', 'carbon_sequestration', 'VM0010', 'Southeast Asia', 2025,
     '{"values": [8.5, 9.2, 7.8, 10.1, 8.9, 9.5, 8.2, 9.8, 8.7, 9.1], "unit": "tCO2e/ha/year", "methodology": "VM0010"}',
     '{"mean": 8.98, "median": 8.95, "std_dev": 0.72, "min": 7.8, "max": 10.1, "p25": 8.5, "p75": 9.5, "p90": 9.8}',
     'Gold Standard Registry', 0.90, 89, true),
     
    ('Project Revenue Benchmarks 2025', 'revenue', NULL, 'Global', 2025,
     '{"values": [15.50, 18.20, 12.80, 22.40, 16.90, 14.75, 19.30, 21.10, 17.45, 15.90], "unit": "USD/tCO2e", "market": "voluntary"}',
     '{"mean": 17.43, "median": 16.9, "std_dev": 2.98, "min": 12.8, "max": 22.4, "p25": 15.5, "p75": 19.3, "p90": 21.1}',
     'Ecosystem Marketplace', 0.88, 523, true),
     
    ('Verification Timeline Benchmarks 2025', 'verification_time', NULL, 'Global', 2025,
     '{"values": [45, 62, 38, 75, 52, 41, 68, 55, 48, 59], "unit": "days", "process": "initial_verification"}',
     '{"mean": 54.3, "median": 53.5, "std_dev": 12.1, "min": 38, "max": 75, "p25": 45, "p75": 62, "p90": 68}',
     'Industry Survey', 0.75, 234, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE report_definitions IS 'Stores report configurations and templates created by users';
COMMENT ON TABLE report_schedules IS 'Scheduled report configurations with cron-style scheduling';
COMMENT ON TABLE report_executions IS 'History of all report executions with status and results';
COMMENT ON TABLE benchmark_datasets IS 'Industry benchmark data for performance comparison';
COMMENT ON TABLE dashboard_widgets IS 'User-specific dashboard widget configurations';
COMMENT ON TABLE dashboard_aggregates IS 'Pre-computed aggregates for fast dashboard loading';
COMMENT ON TABLE report_data_sources IS 'Available data sources for report building';
