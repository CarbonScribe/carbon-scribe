-- Add a real transaction hash and an explicit mock marker to minted_tokens
-- so a mock-minted row can never be mistaken for a real on-chain mint.

ALTER TABLE minted_tokens
    ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE minted_tokens ALTER COLUMN tx_hash DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_minted_tokens_is_mock ON minted_tokens(is_mock);
