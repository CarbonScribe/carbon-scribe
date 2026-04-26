-- +goose Up
-- SQL migration for project quality scoring

CREATE TABLE project_quality_scores (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    methodology_token_id INTEGER NOT NULL,
    overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    components JSONB NOT NULL,
    methodology_score INTEGER,
    authority_score INTEGER,
    registry_score INTEGER,
    version_score INTEGER,
    documentation_score INTEGER,
    calculated_at TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP,
    UNIQUE(project_id, methodology_token_id)
);

CREATE TABLE quality_score_history (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    score INTEGER NOT NULL,
    components JSONB,
    reason VARCHAR(255),
    changed_by VARCHAR(56),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scoring_rules (
    id UUID PRIMARY KEY,
    rule_type VARCHAR(50) NOT NULL,
    condition JSONB NOT NULL,
    points INTEGER NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS scoring_rules;
DROP TABLE IF EXISTS quality_score_history;
DROP TABLE IF EXISTS project_quality_scores;
