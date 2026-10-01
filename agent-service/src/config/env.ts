import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function boolean(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value.toLowerCase() === "true" || value === "1";
}

// Service-to-service auth (issue #579): each upstream caller signs its own
// short-lived HS256 JWT with its own secret and sends it as
// `Authorization: Bearer <token>` (the same Bearer convention
// corporate-platform and project-portal already use for their own
// user-facing JWTs — see their respective auth packages). Keying secrets
// per issuer, rather than one shared secret for every caller, means
// rotating or revoking one caller's credential never affects the others.
// An issuer with no configured secret (empty string) can never
// authenticate — see shared/middleware/auth.middleware.ts, which treats a
// falsy secret as "this issuer isn't trusted" rather than verifying
// against an empty key.
const serviceTokenSecrets: Record<string, string> = {
  "corporate-platform": process.env.CORPORATE_PLATFORM_JWT_SECRET ?? "",
  "project-portal": process.env.PROJECT_PORTAL_JWT_SECRET ?? "",
};

export const env = {
  port: Number(process.env.PORT ?? 4500),
  nodeEnv: process.env.NODE_ENV ?? "development",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  agentModel: process.env.AGENT_MODEL ?? "claude-opus-5",

  agentServiceJwtSecret: process.env.AGENT_SERVICE_JWT_SECRET ?? "",

  serviceTokenSecrets,
  approvalReviewerServices: (process.env.APPROVAL_REVIEWER_SERVICES ?? "")
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean),
  approvalOutboxPollIntervalMs: positiveInteger(
    "APPROVAL_OUTBOX_POLL_INTERVAL_MS",
    3000,
  ),
  approvalOutboxBatchSize: positiveInteger("APPROVAL_OUTBOX_BATCH_SIZE", 20),
  approvalOutboxMaxAttempts: positiveInteger("APPROVAL_OUTBOX_MAX_ATTEMPTS", 5),
  approvalOutboxLockTimeoutMs: positiveInteger(
    "APPROVAL_OUTBOX_LOCK_TIMEOUT_MS",
    60000,
  ),
  approvalOutboxRetryBaseMs: positiveInteger(
    "APPROVAL_OUTBOX_RETRY_BASE_MS",
    1000,
  ),
  approvalOutboxRetryMaxMs: positiveInteger(
    "APPROVAL_OUTBOX_RETRY_MAX_MS",
    60000,
  ),

  corporatePlatformBaseUrl: required(
    "CORPORATE_PLATFORM_BASE_URL",
    "http://localhost:3000",
  ),
  projectPortalBaseUrl: required(
    "PROJECT_PORTAL_BASE_URL",
    "http://localhost:8080",
  ),
  mockProjectPortal:
    boolean("AGENT_SERVICE_MOCK_PROJECT_PORTAL") ||
    boolean("MOCK_PROJECT_PORTAL"),

  agentAuditDatabaseUrl: required(
    "AGENT_AUDIT_DATABASE_URL",
    "postgres://postgres:postgres@localhost:5432/agent_service",
  ),
};
