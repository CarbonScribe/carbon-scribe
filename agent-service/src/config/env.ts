import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
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

  serviceTokenSecrets,

  corporatePlatformBaseUrl: required(
    "CORPORATE_PLATFORM_BASE_URL",
    "http://localhost:3000",
  ),
  projectPortalBaseUrl: required(
    "PROJECT_PORTAL_BASE_URL",
    "http://localhost:8080",
  ),
};
