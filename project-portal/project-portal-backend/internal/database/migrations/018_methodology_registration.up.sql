-- 018_methodology_registration.up.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS methodology_contract_id VARCHAR(56);

CREATE TABLE IF NOT EXISTS methodology_registrations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    methodology_token_id INTEGER NOT NULL,
    contract_id VARCHAR(56) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    registry VARCHAR(100),
    registry_link VARCHAR(500),
    issuing_authority VARCHAR(56),
    owner_address VARCHAR(56),
    ipfs_cid VARCHAR(255),
    registered_at TIMESTAMP DEFAULT NOW(),
    tx_hash VARCHAR(128),
    methodology_verified BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_methodology_registrations_project_id
    ON methodology_registrations(project_id);

CREATE INDEX IF NOT EXISTS idx_methodology_registrations_token_id
    ON methodology_registrations(methodology_token_id);
