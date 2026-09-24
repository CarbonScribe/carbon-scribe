/**
 * Centralized Error Reporting Service
 *
 * Provides structured error capture with:
 * - Typed severity levels
 * - Rate limiting (max N errors per window)
 * - Environment-based filtering (dev vs production)
 * - Forwarding to an observability platform endpoint
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorPayload {
  error: string;
  severity: ErrorSeverity;
  context: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
  requestId?: string;
}

// ── Rate limiter ─────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = Number(process.env.NEXT_PUBLIC_ERROR_RATE_LIMIT_MAX) || 50;
const RATE_LIMIT_WINDOW_MS =
  Number(process.env.NEXT_PUBLIC_ERROR_RATE_LIMIT_WINDOW_MS) || 60_000;

let windowStart = Date.now();
let windowCount = 0;

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= RATE_LIMIT_MAX) return true;
  windowCount++;
  return false;
}

// ── Redaction (#555) ─────────────────────────────────────────────────────────
//
// Telemetry is forwarded off-device to an observability endpoint, so it must
// never carry auth tokens or user-profile data — a call site could always
// pass one in by mistake (e.g. a raw API error body that happens to echo a
// header). This is enforced structurally here, not just by auditing call
// sites, so a future call site can't quietly reintroduce a leak.

const SENSITIVE_METADATA_KEYS = new Set([
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'password',
  'authorization',
  'cookie',
  'user',
  'profile',
  'jwt',
]);

// A JWT is three base64url segments joined by dots; each segment is
// realistically at least ~10 chars. Matches and redacts any such substring
// found in a string value, regardless of which field it's in.
const JWT_LIKE_PATTERN = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function redactJwtLike(value: string): string {
  return value.replace(JWT_LIKE_PATTERN, '[REDACTED_TOKEN]');
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (typeof value === 'string') return redactJwtLike(value);
  return value;
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return metadata;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    sanitized[key] = sanitizeMetadataValue(value);
  }
  return sanitized;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPayload(
  error: unknown,
  severity: ErrorSeverity,
  context: string,
  metadata?: Record<string, unknown>,
  requestId?: string,
): ErrorPayload {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return {
    error: redactJwtLike(rawMessage),
    severity,
    context,
    metadata: sanitizeMetadata({
      ...metadata,
      ...(error instanceof Error && error.stack ? { stack: redactJwtLike(error.stack) } : {}),
    }),
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    requestId,
  };
}

// ── Platform forwarder ───────────────────────────────────────────────────────

const ENDPOINT = process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT;

async function forward(payload: ErrorPayload): Promise<void> {
  if (!ENDPOINT) return;
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Silently ignore forwarding failures to avoid recursion
  }
}

// ── Dev console output ───────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_MIN_SEVERITY = (process.env.NEXT_PUBLIC_ERROR_DEV_MIN_SEVERITY ||
  'warning') as ErrorSeverity;

const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

function shouldLogToConsole(severity: ErrorSeverity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[DEV_MIN_SEVERITY];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Report an error to the centralized telemetry sink.
 *
 * @param error    - The error object or message string
 * @param context  - Component or service name (e.g. 'AuthContext', 'api-client')
 * @param severity - 'info' | 'warning' | 'error' | 'critical' (default: 'error')
 * @param metadata - Additional key/value debug context
 * @param requestId - Correlation ID if available
 */
export function reportError(
  error: unknown,
  context: string,
  severity: ErrorSeverity = 'error',
  metadata?: Record<string, unknown>,
  requestId?: string,
): void {
  if (isRateLimited()) return;

  const payload = buildPayload(error, severity, context, metadata, requestId);

  if (IS_DEV) {
    if (shouldLogToConsole(severity)) {
      // Log the sanitized payload, not the raw error/metadata (#555) — the
      // dev console is still somewhere a token or profile value shouldn't
      // land, e.g. during a screen-shared debugging session.
      // eslint-disable-next-line no-console
      console.error(`[${severity.toUpperCase()}] ${context}:`, payload.error, payload.metadata ?? '');
    }
    // In development, skip remote forwarding unless explicitly configured
    if (!ENDPOINT) return;
  }

  // Fire-and-forget
  forward(payload);
}
