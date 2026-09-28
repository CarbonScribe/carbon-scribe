-- Issue #619: TTL-indexed expiry column on inventory credit cache table.
-- project_credit_cache tracked last_synced but never invalidated stale rows.
-- This migration adds expires_at (computed as last_synced + cacheTTL at write
-- time by the application) plus an index to make expiry queries/purges cheap.

ALTER TABLE project_credit_cache
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill pre-existing rows so they expire 5 minutes after their last sync
-- (matching the service default cacheTTL of 5 minutes). Rows with NULL
-- last_synced fall back to now() + 5 minutes so they expire promptly instead
-- of living forever.
UPDATE project_credit_cache
SET expires_at = COALESCE(last_synced, CURRENT_TIMESTAMP) + INTERVAL '5 minutes'
WHERE expires_at IS NULL;

-- Index supporting efficient expiry-based reads and purges, e.g.
--   SELECT ... WHERE expires_at > NOW()
--   DELETE FROM project_credit_cache WHERE expires_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_project_credit_cache_expires_at
    ON project_credit_cache(expires_at);
