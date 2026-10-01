import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";
import type { ErrorCategory } from "../llm/errors.js";
import {
  mockConfirmAlertResponse,
  mockMethodologies,
} from "./project-portal.client.fixtures.js";

// Thin HTTP client for project-portal-backend (Go). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the remaining endpoints agent tools need, e.g.:
//   - getProject(projectId)
//   - getMonitoringAlerts(projectId, since)
//   - getSatelliteTimeseries(projectId, metric: "ndvi" | "biomass")
// Outbound auth (agent-service authenticating itself to
// project-portal-backend) is a separate, not-yet-specified concern — out
// of scope for issue #579, which replaced the shared-secret check on
// agent-service's own inbound routes (see
// shared/middleware/auth.middleware.ts). project-portal-backend has no
// service-to-service auth guard today regardless of what header this
// client sends, so there is nothing to authenticate against yet.
const http = axios.create({
  baseURL: env.projectPortalBaseUrl,
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
  if (env.mockProjectPortal) {
    return mockMethodologies;
  }
  const response = await withRetry(() => http.get("/methodologies"));
  const parsed = MethodologiesResponseSchema.parse(response.data);
  return parsed.methodologies;
}

// ---------------------------------------------------------------------------
// confirmAlert
// ---------------------------------------------------------------------------
//
// The write half of project-portal-backend's notification pipeline
// (internal/notifications): once a reviewer has approved an alert-triage
// `escalate` verdict, the agent service pushes the confirmed alert through
// here so the backend can fan it out over its configured channels/rules.
//
// The package's only existing write route today is user-scoped
// (`POST /api/v1/notifications/send`, whose `SendNotificationRequest` binds a
// required `user_id` and non-empty `channels` — see
// internal/notifications/models.go), so a service-to-service caller that only
// knows which project a monitoring alert belongs to cannot address it. This
// client targets `POST /internal/notifications/confirmed-alerts` as the
// project-scoped, service-to-service shape that route should take once added,
// the same forward-looking contract convention `getMethodologies` uses above.
// The `Notification` model it validates against (`id`, `project_id`,
// `category`, `subject`, `status`, `created_at`) is the one the notifications
// package already returns from `SendNotification`. Adding the backend route
// is tracked separately.

/**
 * A confirmed alert pushed into project-portal's notification pipeline.
 * Mirrors the fields internal/notifications' `Notification` model keys on,
 * with the agent's triage evidence carried in `metadata` so the reviewer's
 * approval stays auditable end to end.
 */
export interface ConfirmAlertPayload {
  /** Routing category the notifications package uses to pick rules/templates. */
  category: string;
  /** Human-readable subject line. */
  subject: string;
  /** Notification body — the triage reasoning the reviewer approved. */
  content: string;
  /** Channels to deliver on; omit to let project-portal apply its defaults. */
  channels?: string[];
  /**
   * Idempotency key for this alert (the agent run's requestId). The write is
   * retried on transient failures, so the backend must de-duplicate on this
   * value to avoid raising the same alert twice.
   */
  idempotencyKey?: string;
  /** Structured triage evidence (verdict, reasoning, citations, run ids). */
  metadata?: Record<string, unknown>;
}

/** The notification project-portal assigns/returns for a confirmed alert. */
const ConfirmAlertResponseSchema = z.object({
  /** Notification id assigned by project-portal. */
  id: z.string(),
  /** Project the notification was filed against. */
  project_id: z.string().optional(),
  category: z.string().optional(),
  subject: z.string().optional(),
  /** Notification lifecycle status, e.g. "PENDING" / "SENT" / "FAILED". */
  status: z.string(),
  created_at: z.coerce.date().optional(),
});

export type ConfirmAlertResponse = z.infer<typeof ConfirmAlertResponseSchema>;

/**
 * Push a human-approved alert-triage escalation into project-portal's
 * notification pipeline.
 *
 * Request: `POST /internal/notifications/confirmed-alerts` on
 * project-portal-backend, body `{ project_id, ...alertPayload }` (the
 * idempotency key is sent as an `Idempotency-Key` header, not in the body).
 * Response body (on success): the created `Notification` — at minimum its
 * assigned `id` and lifecycle `status`.
 *
 * Retries transient network errors or 5xx responses up to
 * {@link MAX_RETRIES} times with exponential backoff; 4xx responses and
 * schema-validation failures are not retried and reject immediately. Because
 * this is a write, callers must supply `alertPayload.idempotencyKey` so a
 * retried request cannot raise a duplicate notification.
 *
 * @throws {z.ZodError} if the response body doesn't match the expected
 * notification shape — treated as a hard failure rather than passed through
 * unvalidated.
 */
async function confirmAlert(
  projectId: string,
  alertPayload: ConfirmAlertPayload,
): Promise<ConfirmAlertResponse> {
  if (env.mockProjectPortal) {
    return {
      ...mockConfirmAlertResponse,
      project_id: projectId,
      category: alertPayload.category ?? mockConfirmAlertResponse.category,
      subject: alertPayload.subject ?? mockConfirmAlertResponse.subject,
    };
  }
  const { idempotencyKey, ...body } = alertPayload;
  const response = await withRetry(() =>
    http.post(
      "/internal/notifications/confirmed-alerts",
      { project_id: projectId, ...body },
      idempotencyKey
        ? { headers: { "Idempotency-Key": idempotencyKey } }
        : undefined,
    ),
  );
  return ConfirmAlertResponseSchema.parse(response.data);
}

/**
 * Classify a failure from {@link confirmAlert} so callers can surface *why* a
 * downstream notification push failed, separately from any failure earlier in
 * the agent run. Mirrors `shared/llm/errors.ts`' classification for the
 * Anthropic client: a 4xx is a permanent rejection, no-response/5xx is a
 * transient one, and an unusable 2xx body (a `z.ZodError`) is a contract
 * failure that retrying will not fix.
 */
export function classifyConfirmAlertError(err: unknown): {
  category: ErrorCategory;
  retryable: boolean;
} {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (typeof status === "number") {
      return status >= 500
        ? { category: "connection_error", retryable: true }
        : { category: "invalid_request", retryable: false };
    }
    return { category: "connection_error", retryable: true };
  }
  return { category: "unknown", retryable: false };
}

export const projectPortalClient = {
  http,
  getMethodologies,
  confirmAlert,
};
