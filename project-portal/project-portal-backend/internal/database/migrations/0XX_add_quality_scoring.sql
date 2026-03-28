-- Migration: 0XX_add_quality_scoring.sql
-- Creates tables for project quality scores, history, and configurable rules.

-- ─── Project quality scores (current state) ────────────────────────────────
CREATE TABLE IF NOT EXISTS project_quality_scores (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    methodology_token_id INTEGER    NOT NULL,
    overall_score       INTEGER     NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    components          JSONB       NOT NULL DEFAULT '{}',
    methodology_score   INTEGER,
    authority_score     INTEGER,
    registry_score      INTEGER,
    version_score       INTEGER,
    documentation_score INTEGER,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until         TIMESTAMPTZ,

    UNIQUE(project_id, methodology_token_id)
);

CREATE INDEX IF NOT EXISTS idx_pqs_project_id        ON project_quality_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_pqs_overall_score     ON project_quality_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_pqs_calculated_at     ON project_quality_scores(calculated_at DESC);

COMMENT ON TABLE  project_quality_scores                    IS 'Current quality scores per project/methodology pair.';
COMMENT ON COLUMN project_quality_scores.components         IS 'JSONB breakdown: {registry, authority, methodology, version, documentation}.';
COMMENT ON COLUMN project_quality_scores.overall_score      IS 'Composite score 0-100 (sum of all weighted components).';
COMMENT ON COLUMN project_quality_scores.valid_until        IS 'Score is considered stale after this timestamp.';

-- ─── Quality score history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_score_history (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    score       INTEGER     NOT NULL CHECK (score BETWEEN 0 AND 100),
    components  JSONB,
    reason      VARCHAR(255),
    changed_by  VARCHAR(56),  -- Stellar address or system identifier
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qsh_project_id  ON quality_score_history(project_id);
CREATE INDEX IF NOT EXISTS idx_qsh_created_at  ON quality_score_history(created_at DESC);

COMMENT ON TABLE  quality_score_history            IS 'Immutable log of every quality score change.';
COMMENT ON COLUMN quality_score_history.changed_by IS 'Stellar address of the admin who triggered recalculation, or "system".';

-- ─── Scoring rules (configurable) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scoring_rules (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type   VARCHAR(50) NOT NULL CHECK (rule_type IN ('REGISTRY','AUTHORITY','VERSION','DOCUMENTATION','METHODOLOGY')),
    condition   JSONB       NOT NULL,
    points      INTEGER     NOT NULL,
    priority    INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_rule_type ON scoring_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_sr_is_active ON scoring_rules(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE  scoring_rules           IS 'Configurable scoring rules. Evaluated in descending priority order.';
COMMENT ON COLUMN scoring_rules.condition IS 'JSONB match criteria, e.g. {"registry":"Verra"} or {"has_cid":true}.';
COMMENT ON COLUMN scoring_rules.points    IS 'Points awarded when the condition matches.';

-- ─── Seed default scoring rules (mirrors issue spec §Scoring Components) ───
INSERT INTO scoring_rules (rule_type, condition, points, priority) VALUES
    -- Registry Authority (max 30)
    ('REGISTRY',      '{"registry": "Verra"}',                  30, 100),
    ('REGISTRY',      '{"registry": "Gold Standard"}',           30, 100),
    ('REGISTRY',      '{"registry": "CAR"}',                     20,  90),
    ('REGISTRY',      '{"registry": "Plan Vivo"}',               20,  90),
    ('REGISTRY',      '{"registry": "Regional"}',                10,  80),

    -- Issuing Authority (max 20)
    ('AUTHORITY',     '{"verified": true}',                      20, 100),
    ('AUTHORITY',     '{"verified": false}',                      0,  90),

    -- Methodology Type (max 20)
    ('METHODOLOGY',   '{"methodology_type": "Afforestation"}',   20, 100),
    ('METHODOLOGY',   '{"methodology_type": "Reforestation"}',   20, 100),
    ('METHODOLOGY',   '{"methodology_type": "IFM"}',             18,  90),
    ('METHODOLOGY',   '{"methodology_type": "Agroforestry"}',    15,  80),
    ('METHODOLOGY',   '{"methodology_type": "Soil Carbon"}',     12,  70),

    -- Version Recency (max 15)
    ('VERSION',       '{"version": "v2"}',                       15, 100),
    ('VERSION',       '{"version": "v3"}',                       15, 100),
    ('VERSION',       '{"version": "v1"}',                        8,  90),
    ('VERSION',       '{"version": ""}',                         10,  80),  -- unknown

    -- Documentation (max 15)
    ('DOCUMENTATION', '{"has_cid": true}',                       15, 100),
    ('DOCUMENTATION', '{"has_cid": false}',                       0,  90)

ON CONFLICT DO NOTHING;