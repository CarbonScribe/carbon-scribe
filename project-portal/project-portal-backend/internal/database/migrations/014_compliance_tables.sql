-- Migration: 014_compliance_tables
-- Description: Create tables for Data Privacy & Compliance Service
-- Date: 2026-02-20

-- Data retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    data_category VARCHAR(100) NOT NULL,
    jurisdiction VARCHAR(50) DEFAULT 'global',

    retention_period_days INTEGER NOT NULL,
    archival_period_days INTEGER,
    review_period_days INTEGER DEFAULT 365,

    deletion_method VARCHAR(50) DEFAULT 'soft_delete',
    anonymization_rules JSONB,

    legal_hold_enabled BOOLEAN DEFAULT TRUE,

    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_category ON retention_policies(data_category);
CREATE INDEX IF NOT EXISTS idx_retention_policies_jurisdiction ON retention_policies(jurisdiction);

CREATE TRIGGER update_retention_policies_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User data requests (GDPR requests)
CREATE TABLE IF NOT EXISTS privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    request_subtype VARCHAR(50),

    status VARCHAR(50) DEFAULT 'received',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,

    data_categories TEXT[],
    date_range_start TIMESTAMPTZ,
    date_range_end TIMESTAMPTZ,

    verification_method VARCHAR(50),
    verified_by UUID,
    verified_at TIMESTAMPTZ,

    export_file_url TEXT,
    export_file_hash VARCHAR(64),
    deletion_summary JSONB,
    error_message TEXT,

    legal_basis VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_user ON privacy_requests(user_id, request_type);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status);

CREATE TRIGGER update_privacy_requests_updated_at
    BEFORE UPDATE ON privacy_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Privacy preferences
CREATE TABLE IF NOT EXISTS privacy_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,

    marketing_emails BOOLEAN DEFAULT FALSE,
    promotional_emails BOOLEAN DEFAULT FALSE,
    system_notifications BOOLEAN DEFAULT TRUE,
    third_party_sharing BOOLEAN DEFAULT FALSE,
    analytics_tracking BOOLEAN DEFAULT TRUE,

    data_retention_consent BOOLEAN DEFAULT TRUE,
    research_participation BOOLEAN DEFAULT FALSE,
    automated_decision_making BOOLEAN DEFAULT FALSE,

    jurisdiction VARCHAR(50) DEFAULT 'GDPR',

    version INTEGER DEFAULT 1,
    previous_version_id UUID,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_preferences_user ON privacy_preferences(user_id);

CREATE TRIGGER update_privacy_preferences_updated_at
    BEFORE UPDATE ON privacy_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Consent records (granular tracking)
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    consent_type VARCHAR(100) NOT NULL,
    consent_version VARCHAR(50) NOT NULL,
    consent_given BOOLEAN NOT NULL,

    context TEXT,
    purpose TEXT,

    ip_address INET,
    user_agent TEXT,
    geolocation VARCHAR(100),

    expires_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user ON consent_records(user_id, consent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_records_type ON consent_records(consent_type);

-- Immutable audit logs (WORM pattern)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,

    event_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(100) NOT NULL,
    event_action VARCHAR(50) NOT NULL,

    actor_id UUID,
    actor_type VARCHAR(50),
    actor_ip INET,

    target_type VARCHAR(100),
    target_id UUID,
    target_owner_id UUID,

    data_category VARCHAR(100),
    sensitivity_level VARCHAR(50) DEFAULT 'normal',

    service_name VARCHAR(100) NOT NULL,
    endpoint VARCHAR(500),
    http_method VARCHAR(10),

    old_values JSONB,
    new_values JSONB,

    permission_used VARCHAR(100),

    signature VARCHAR(512),
    hash_chain VARCHAR(64),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_time ON audit_logs(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_owner ON audit_logs(target_owner_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitivity ON audit_logs(sensitivity_level, event_time DESC);

-- Data retention schedule
CREATE TABLE IF NOT EXISTS retention_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES retention_policies(id),
    data_type VARCHAR(100) NOT NULL,

    next_review_date DATE NOT NULL,
    next_action_date DATE,
    action_type VARCHAR(50),

    last_action_date DATE,
    last_action_type VARCHAR(50),
    last_action_result VARCHAR(50),

    record_count_estimate BIGINT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retention_schedules_policy ON retention_schedules(policy_id);
CREATE INDEX IF NOT EXISTS idx_retention_schedules_next_action ON retention_schedules(next_action_date);

CREATE TRIGGER update_retention_schedules_updated_at
    BEFORE UPDATE ON retention_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Legal holds
CREATE TABLE IF NOT EXISTS legal_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reason TEXT NOT NULL,

    status VARCHAR(50) DEFAULT 'active',

    data_categories TEXT[],
    affected_user_ids UUID[],

    initiated_by UUID NOT NULL,
    released_by UUID,

    initiated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_status ON legal_holds(status);

CREATE TRIGGER update_legal_holds_updated_at
    BEFORE UPDATE ON legal_holds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
