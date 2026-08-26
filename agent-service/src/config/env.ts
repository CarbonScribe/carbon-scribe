import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4500),
  nodeEnv: process.env.NODE_ENV ?? "development",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  agentModel: process.env.AGENT_MODEL ?? "claude-opus-5",

  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? "",

  corporatePlatformBaseUrl: required(
    "CORPORATE_PLATFORM_BASE_URL",
    "http://localhost:3000",
  ),
  projectPortalBaseUrl: required(
    "PROJECT_PORTAL_BASE_URL",
    "http://localhost:8080",
  ),

  agentAuditDatabaseUrl: required(
    "AGENT_AUDIT_DATABASE_URL",
    "postgres://postgres:postgres@localhost:5432/agent_service",
  ),
};
