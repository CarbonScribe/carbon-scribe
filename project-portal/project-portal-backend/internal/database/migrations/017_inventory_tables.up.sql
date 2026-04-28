-- Project Credit Cache: stores on-chain credit data from Carbon Asset contract
CREATE TABLE IF NOT EXISTS project_credit_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token_id INTEGER NOT NULL,
    owner_address VARCHAR(56) NOT NULL,
    status VARCHAR(20),
    vintage_year BIGINT,
    methodology_id INTEGER,
    quality_score BIGINT DEFAULT 0,
    is_burned BOOLEAN DEFAULT FALSE,
    last_synced TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, token_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_project_id ON project_credit_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_status ON project_credit_cache(status);
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_owner ON project_credit_cache(owner_address);
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_vintage ON project_credit_cache(vintage_year);
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_last_synced ON project_credit_cache(last_synced);
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_project_status ON project_credit_cache(project_id, status) WHERE is_burned = FALSE;
