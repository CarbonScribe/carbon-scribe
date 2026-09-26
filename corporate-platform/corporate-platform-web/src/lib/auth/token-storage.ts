/**
 * Token Storage
 *
 * Both the access token and the refresh token are currently stored in
 * plain browser localStorage, readable by any script running on this
 * origin (including a successful XSS payload). This is a known, accepted
 * interim risk, not the intended end state — see
 * docs/security/token-storage-review.md for the full threat model,
 * why the refresh token isn't moved to memory-only storage as a stopgap
 * (it would silently break this app's multi-tab session sync without
 * actually stopping an in-page XSS payload from reading it), and what
 * moving it to a real HttpOnly/Secure/SameSite=Strict cookie would take
 * (a corporate-platform-backend change, out of scope for this file).
 *
 * What *is* implemented here to reduce the blast radius in the meantime:
 * - Only minimal, non-sensitive display fields are persisted for the user
 *   profile (see storeUser) — not the full AuthUser object.
 * - isTokenExpired() is derived from the access token's own JWT `exp`
 *   claim, not solely from a separate, independently-client-writable
 *   timestamp.
 * - The old accessToken/access_token legacy-key migration has been
 *   removed: an unrecognized value is never silently trusted.
 * - reportError (see lib/telemetry/errorReporter.ts) structurally redacts
 *   token-shaped values and known-sensitive keys before anything here (or
 *   anywhere else in the app) can leak one into telemetry.
 */

import { reportError } from '@/lib/telemetry/errorReporter';
import { isClient, safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/utils/hydration';

const ACCESS_TOKEN_KEY = 'cs_access_token';
const REFRESH_TOKEN_KEY = 'cs_refresh_token';
const USER_KEY = 'cs_user';
const TOKEN_EXPIRY_KEY = 'cs_token_expiry';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp when access token expires
}

/**
 * The only user fields persisted to storage: enough for an immediate,
 * pre-hydration UI render (e.g. a greeting), nothing sensitive. The full
 * profile always comes from a live getProfileApi() call — see
 * AuthContext.syncProfile — so this is a display cache, not the source of
 * truth for role/permissions/company/email.
 */
export interface MinimalStoredUser {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Decodes a JWT's payload without verifying its signature — this is only
 * ever used to read the token's own `exp` claim for client-side expiry UX.
 * The server remains the sole authority on whether a token is actually
 * valid: it verifies the signature (and expiry) independently on every
 * request, so a forged/altered value here cannot grant access, only
 * mislead this client's own "should I proactively refresh?" heuristic.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
    const json = decodeURIComponent(
      Array.from(binary)
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );

    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Returns the JWT's own `exp` claim in milliseconds since epoch, or null
 * if the token isn't a decodable JWT or has no `exp` claim.
 */
function getJwtExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/**
 * Store authentication tokens securely
 */
export function storeTokens(accessToken: string, refreshToken: string, expiresIn: number = 900): void {
  if (!isClient()) return;

  const expiresAt = Date.now() + expiresIn * 1000;
  
  try {
    safeSetItem(ACCESS_TOKEN_KEY, accessToken);
    safeSetItem(REFRESH_TOKEN_KEY, refreshToken);
    safeSetItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'storeTokens' });
  }
}

/**
 * Get the stored access token.
 *
 * Note (#555): this no longer migrates from the legacy 'accessToken' /
 * 'access_token' keys. That migration trusted whatever value sat under
 * those keys with no validation and silently re-persisted it under the
 * current key — a session predating this app's current key names simply
 * requires a fresh login now, which is the expected, graceful outcome
 * (see clearAuthData()/AuthContext's init flow), not a crash.
 */
export function getAccessToken(): string | null {
  if (!isClient()) return null;

  try {
    return safeGetItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'getAccessToken' });
    return null;
  }
}

/**
 * Get the stored refresh token
 */
export function getRefreshToken(): string | null {
  if (!isClient()) return null;
  
  try {
    return safeGetItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'getRefreshToken' });
    return null;
  }
}

/**
 * Get the access token's expiry timestamp (ms since epoch).
 *
 * Derived primarily from the current access token's own decoded JWT `exp`
 * claim (#555) — falling back to the separately-stored, client-computed
 * TOKEN_EXPIRY_KEY value only when the token isn't a decodable JWT (e.g.
 * an opaque token in a test/dev context). This doesn't change the actual
 * security boundary — the server independently validates the token's
 * signature and expiry on every request regardless of what this function
 * returns — but it keeps this client-side "should I refresh?" heuristic
 * honest about the token it's actually holding, rather than trusting a
 * value that could drift out of sync with it.
 */
export function getTokenExpiry(): number | null {
  if (!isClient()) return null;

  try {
    const token = safeGetItem(ACCESS_TOKEN_KEY);
    if (token) {
      const jwtExpiry = getJwtExpiryMs(token);
      if (jwtExpiry !== null) return jwtExpiry;
    }

    const expiry = safeGetItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'getTokenExpiry' });
    return null;
  }
}

/**
 * Check if the access token is expired or about to expire
 * @param bufferSeconds - Buffer time before actual expiry (default: 60 seconds)
 */
export function isTokenExpired(bufferSeconds: number = 60): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  
  const now = Date.now();
  return now >= (expiry - bufferSeconds * 1000);
}

/**
 * Check if refresh token exists
 */
export function hasRefreshToken(): boolean {
  return getRefreshToken() !== null;
}

/**
 * Clear all authentication data
 */
export function clearAuthData(): void {
  if (!isClient()) return;
  
  try {
    safeRemoveItem(ACCESS_TOKEN_KEY);
    safeRemoveItem(REFRESH_TOKEN_KEY);
    safeRemoveItem(TOKEN_EXPIRY_KEY);
    safeRemoveItem(USER_KEY);
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'clearAuthData' });
  }
}

/**
 * Store user data.
 *
 * Only persists id/firstName/lastName (#555) — never role, permissions,
 * companyId, or email, regardless of what's passed in. This is enforced
 * here structurally (the full AuthUser profile is what callers actually
 * have in hand, e.g. AuthContext.syncProfile's live API response), so a
 * future caller can't accidentally widen what ends up in localStorage.
 * The full profile is always re-fetched from getProfileApi() on hydration;
 * this is a display-only cache for the brief window before that resolves.
 */
export function storeUser(user: { id?: string; firstName?: string; lastName?: string }): void {
  if (!isClient()) return;

  try {
    const minimal: MinimalStoredUser = {
      id: user?.id ?? '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
    };
    safeSetItem(USER_KEY, JSON.stringify(minimal));
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'storeUser' });
  }
}

/**
 * Get the stored (minimal) user data — see storeUser and
 * MinimalStoredUser. Not the full profile; use AuthContext's `user` for
 * that.
 */
export function getUser(): MinimalStoredUser | null {
  if (!isClient()) return null;

  try {
    const userStr = safeGetItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    reportError(error, 'token-storage', 'warning', { operation: 'getUser' });
    return null;
  }
}

/**
 * Check if user is authenticated (has valid tokens)
 */
export function isAuthenticated(): boolean {
  const hasToken = getAccessToken() !== null;
  const notExpired = !isTokenExpired();
  return hasToken && notExpired;
}

/**
 * Get seconds remaining until token expiry.
 * Returns 0 if token is already expired or not found.
 */
export function getTimeUntilExpiry(): number {
  const expiry = getTokenExpiry();
  if (!expiry) return 0;
  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}