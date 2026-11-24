import { createHash } from 'crypto';

/**
 * Password reset tokens are stored as this hash, never as the raw value
 * (#810) — only the raw token (sent to the user by email) can be exchanged
 * for a reset; the stored hash alone is useless to anyone with database or
 * backup access.
 */
export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
