import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";

// Thin HTTP client for project-portal-backend (Go). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the remaining endpoints agent tools need, e.g.:
//   - getProject(projectId)
//   - getMonitoringAlerts(projectId, since)
//   - getSatelliteTimeseries(projectId, metric: "ndvi" | "biomass")
const http = axios.create({
  baseURL: env.projectPortalBaseUrl,
  headers: env.internalServiceToken
    ? { "x-internal-token": env.internalServiceToken }
    : undefined,
});

// ---------------------------------------------------------------------------
// getMethodologies
// ---------------------------------------------------------------------------
//
// project-portal-backend's methodology package
// (internal/project/methodology/handler.go) only exposes routes keyed by an
// already-registered on-chain methodology_token_id or an existing project
// id (/methodologies/:tokenId/..., /projects/:id/methodology) — there is no
// route today that returns the static catalog of methodology types (with
// their documentation requirements) a new, unregistered project could be
// matched against. This client targets GET /methodologies as the shape
// that route should take once added, following this backend's existing
// list-response convention (see e.g. internal/notifications/handler.go's
// `gin.H{"notifications": items}`): `{ "methodologies": Methodology[] }`.
// Adding that backend route is tracked separately; this client validates
// against the contract it will need to satisfy.

const MethodologySchema = z.object({
  /** Stable identifier used for matching, e.g. "agroforestry". */
  id: z.string(),
  /** Human-readable name, e.g. "Agroforestry". */
  name: z.string(),
  /** Activity-type strings this methodology matches (case-insensitive). */
  activityTypes: z.array(z.string()),
  /**
   * ISO country codes / names this methodology is registered for. Empty
   * means globally applicable — most methodology types have no
   * jurisdiction restriction today, but the catalog can carry one per
   * entry once a registry actually imposes it.
   */
  countries: z.array(z.string()),
  requiredDocuments: z.array(z.string()),
});

const MethodologiesResponseSchema = z.object({
  methodologies: z.array(MethodologySchema),
});

export type Methodology = z.infer<typeof MethodologySchema>;

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;

function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }
  // No response at all means the request never completed (network error,
  // timeout, connection reset) — worth retrying. A response with a 4xx
  // status is a permanent rejection and retrying it would just repeat the
  // same failure.
  if (!err.response) {
    return true;
  }
  return err.response.status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries `fn` on a transient network/5xx failure with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryableError(err)) {
        throw err;
      }
      await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
      attempt += 1;
    }
  }
}

/**
 * Fetch the catalog of eligible methodology types (agroforestry, improved
 * forest management, biochar, mangrove restoration, soil carbon, renewable
 * energy) with their documentation requirements.
 *
 * Request: `GET /methodologies` on project-portal-backend.
 * Response body (on success): `{ methodologies: Methodology[] }` where
 * `Methodology` is `{ id, name, activityTypes, countries, requiredDocuments }`.
 *
 * Retries transient network errors or 5xx responses up to
 * {@link MAX_RETRIES} times with exponential backoff; 4xx responses and
 * schema-validation failures are not retried and reject immediately.
 *
 * @throws {z.ZodError} if the response body doesn't match the expected
 * methodology-list shape — this is treated as a hard failure rather than
 * passed through unvalidated.
 */
async function getMethodologies(): Promise<Methodology[]> {
  const response = await withRetry(() => http.get("/methodologies"));
  const parsed = MethodologiesResponseSchema.parse(response.data);
  return parsed.methodologies;
}

export const projectPortalClient = {
  http,
  getMethodologies,
};
