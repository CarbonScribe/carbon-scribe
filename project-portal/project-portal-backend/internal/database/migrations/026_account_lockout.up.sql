-- Add account lockout fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL;

-- Create index for querying locked accounts and expiration
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
