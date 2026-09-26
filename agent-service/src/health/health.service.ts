import { anthropic, DEFAULT_MODEL } from "../llm/client.js";
import { corporatePlatformClient } from "../clients/corporate-platform.client.js";
import { projectPortalClient } from "../clients/project-portal.client.js";

// Readiness probe (issue #580), following the same shape as
// corporate-platform-backend's HealthService (see implementation.md):
// dependency checks run in parallel (bounded by the slowest single
// timeout, not the sum of all of them) and each is individually
// time-boxed so a hung upstream can't make the probe itself hang.
const DEPENDENCY_CHECK_TIMEOUT_MS = 3000;

export interface HealthCheckDetail {
  status: "healthy" | "unhealthy";
  latencyMs?: number;
  error?: string;
}

export interface ReadinessResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    anthropic: HealthCheckDetail;
    corporatePlatform: HealthCheckDetail;
    projectPortal: HealthCheckDetail;
  };
}

const startTime = Date.now();

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(timeoutMessage)),
        timeoutMs,
      );
      // Don't let a pending health-check timer keep the process alive.
      timer.unref?.();
    }),
  ]);
}

async function runCheck(
  check: () => Promise<unknown>,
  timeoutMessage: string,
): Promise<HealthCheckDetail> {
  const start = Date.now();
  try {
    await withTimeout(check(), DEPENDENCY_CHECK_TIMEOUT_MS, timeoutMessage);
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "unhealthy",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Verifies the configured Claude model is reachable via the Models API — a
 * metadata lookup, not a completion, so this costs no output tokens. */
function checkAnthropic(): Promise<HealthCheckDetail> {
  return runCheck(
    () => anthropic.models.retrieve(DEFAULT_MODEL),
    "Anthropic API check timed out",
  );
}

/** Hits corporate-platform-backend's own liveness probe rather than its
 * readiness probe, so a transient dip in *its* dependencies (Kafka, IPFS,
 * etc.) doesn't cascade into agent-service reporting itself unready over
 * something it doesn't actually depend on. */
function checkCorporatePlatform(): Promise<HealthCheckDetail> {
  return runCheck(
    () => corporatePlatformClient.http.get("/health/liveness"),
    "corporate-platform reachability check timed out",
  );
}

function checkProjectPortal(): Promise<HealthCheckDetail> {
  return runCheck(
    () => projectPortalClient.http.get("/health"),
    "project-portal reachability check timed out",
  );
}

export async function getReadiness(): Promise<ReadinessResponse> {
  const [anthropicResult, corporatePlatformResult, projectPortalResult] =
    await Promise.all([
      checkAnthropic(),
      checkCorporatePlatform(),
      checkProjectPortal(),
    ]);

  const isHealthy =
    anthropicResult.status === "healthy" &&
    corporatePlatformResult.status === "healthy" &&
    projectPortalResult.status === "healthy";

  return {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      anthropic: anthropicResult,
      corporatePlatform: corporatePlatformResult,
      projectPortal: projectPortalResult,
    },
  };
}
