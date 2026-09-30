/**
 * Single source of truth for session-expiry timing.
 *
 * Shared by AuthContext (owns the sessionExpiryState state machine),
 * SessionExpiryBanner (non-blocking UI for the "warning" state), and
 * SessionTimeoutModal (blocking UI for the "grace" state — see the doc
 * comment atop that component for how the two divide the states between
 * them). Previously `useSessionWarning` in useAuth.ts also hard-coded its
 * own independent `warningSeconds = 300` default and polled
 * localStorage directly; that hook was dead code (never imported) and has
 * been removed rather than reconciled, so this module is now the only
 * place these thresholds are defined.
 */

export const SESSION_WARNING_SECONDS =
  parseInt(process.env.NEXT_PUBLIC_SESSION_EXPIRY_WARNING_MINUTES || '5', 10) * 60;

export const SESSION_GRACE_SECONDS =
  parseInt(process.env.NEXT_PUBLIC_SESSION_GRACE_SECONDS || '30', 10);

export const TOKEN_REFRESH_BUFFER =
  parseInt(process.env.NEXT_PUBLIC_TOKEN_REFRESH_BUFFER || '60', 10);
