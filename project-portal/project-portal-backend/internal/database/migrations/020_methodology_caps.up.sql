-- 020_methodology_caps.up.sql

CREATE TABLE IF NOT EXISTS methodology_caps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    methodology_token_id INTEGER UNIQUE NOT NULL,
    max_supply BIGINT NOT NULL,
    current_supply BIGINT NOT NULL DEFAULT 0,
    cap_per_project BIGINT,
    cap_per_vintage BIGINT,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_by VARCHAR(56),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_methodology_caps_registration
        FOREIGN KEY (methodology_token_id) REFERENCES methodology_registrations(methodology_token_id)
);

CREATE INDEX IF NOT EXISTS idx_methodology_caps_effective_window
    ON methodology_caps (effective_from, effective_to);

CREATE TABLE IF NOT EXISTS minting_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    methodology_token_id INTEGER NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id),
    requested_amount BIGINT NOT NULL,
    approved BOOLEAN NOT NULL,
    rejection_reason TEXT,
    current_supply_before BIGINT,
    current_supply_after BIGINT,
    vintage_year INTEGER,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_minting_attempts_registration
        FOREIGN KEY (methodology_token_id) REFERENCES methodology_registrations(methodology_token_id)
);

CREATE INDEX IF NOT EXISTS idx_minting_attempts_methodology_time
    ON minting_attempts (methodology_token_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_minting_attempts_project
    ON minting_attempts (project_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_minting_attempts_approved
    ON minting_attempts (methodology_token_id, approved);

CREATE TABLE IF NOT EXISTS cap_configuration_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    methodology_token_id INTEGER NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_reference TEXT,
    cap_configuration JSONB NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cap_sources_registration
        FOREIGN KEY (methodology_token_id) REFERENCES methodology_registrations(methodology_token_id)
);

CREATE INDEX IF NOT EXISTS idx_cap_configuration_sources_methodology
    ON cap_configuration_sources (methodology_token_id, applied_at DESC);
