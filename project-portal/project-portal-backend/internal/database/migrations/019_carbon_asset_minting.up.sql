-- Carbon Asset Minting tables

CREATE TABLE IF NOT EXISTS minting_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    verification_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    tx_hash VARCHAR(128),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_minting_jobs_project_id ON minting_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_minting_jobs_status ON minting_jobs(status);

CREATE TABLE IF NOT EXISTS minted_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES minting_jobs(id) ON DELETE CASCADE,
    token_id INTEGER NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id),
    vintage_year INTEGER NOT NULL,
    methodology_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_minted_tokens_job_id ON minted_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_minted_tokens_project_id ON minted_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_minted_tokens_token_id ON minted_tokens(token_id);
