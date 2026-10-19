import axios, { type AxiosResponse } from "axios";
import { z } from "zod";
import { env } from "../config/env.js";
import { signServiceToken } from "../shared/auth/service-token.js";
import { logger } from "../shared/logging/logger.js";

// Thin HTTP client for corporate-platform-backend (NestJS). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the remaining endpoints agent tools need, e.g.:
//   - listMarketplaceCredits(filters)
//   - getComplianceFramework(framework: "csrd" | "cbam" | "corsia" | "sbti" | "ghg-protocol")
//   - getRetirementHistory(companyId)
// Outbound requests use the same short-lived HS256 service-token format as
// agent-service's inbound auth, with issuer "agent-service". The backend
// must register AGENT_SERVICE_JWT_SECRET for that issuer and enforce it with
// a matching service-token guard before these credentials are authenticated.
const http = axios.create({
  baseURL: env.corporatePlatformBaseUrl,
});

http.interceptors.request.use((config) => {
  if (!env.agentServiceJwtSecret) {
    throw new Error("Missing required env var: AGENT_SERVICE_JWT_SECRET");
  }

  config.headers.Authorization = `Bearer ${signServiceToken(
    "agent-service",
    env.agentServiceJwtSecret,
  )}`;
  return config;
});

// ---------------------------------------------------------------------------
// getPortfolio
// ---------------------------------------------------------------------------
//
// corporate-platform-backend's existing PortfolioController
// (src/portfolio/portfolio.controller.ts) only exposes JWT-scoped routes
// that resolve companyId from the authenticated user's own token
// (/api/v1/portfolio/{summary,composition,performance,timeline,risk,holdings,analytics}) —
// there is no route today that takes an arbitrary companyId for a
// service-to-service caller like agent-service. This client targets
// GET /api/v1/portfolio/:companyId as the shape that route should take once
// added — an internal, company-scoped read exposing the same summary +
// holdings data getPortfolioSummary/getPortfolioHoldings already compute
// (see portfolio.service.ts), wrapped in the same
// `{ success, data, timestamp }` envelope every other route in that
// controller already returns. Adding that backend route is tracked
// separately; this client validates against the contract it will need to
// satisfy.

/** A single credit holding within a company's portfolio. */
const PortfolioHoldingSchema = z.object({
  creditId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  methodology: z.string().nullable().optional(),
  vintage: z.number().int().nullable().optional(),
  quantity: z.number(),
  currentValue: z.number(),
});

/**
 * A company's current carbon credit portfolio: summary metrics (mirrors
 * corporate-platform-backend's `Portfolio` Prisma model / PortfolioSummaryMetrics)
 * plus the individual holdings backing it.
 */
const PortfolioSchema = z.object({
  companyId: z.string(),
  totalRetired: z.number(),
  currentBalance: z.number(),
  totalValue: z.number(),
  avgPricePerTon: z.number(),
  riskRating: z.string(),
  holdings: z.array(PortfolioHoldingSchema),
});

const PortfolioResponseSchema = z.object({
  success: z.boolean(),
  data: PortfolioSchema,
  timestamp: z.coerce.date(),
});

export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;

function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }
  // No response at all means the request never completed (network error,
  // timeout, connection reset) — worth retrying. A response with a 4xx
  // status is a permanent rejection (bad companyId, auth failure, etc.)
  // and retrying it would just repeat the same failure.
  if (!err.response) {
    return true;
  }
  return err.response.status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Request/response logging (#706)
// ---------------------------------------------------------------------------
//
// Every exported client function routes its HTTP call through
// requestWithLogging (which itself drives withRetry) rather than calling
// `http.<method>` directly, so logging stays consistent as more endpoints
// are added here (see the file-level TODO) instead of each new function
// reimplementing it. Bodies are never logged — only method/path/status/
// duration/shape — to avoid duplicating the redaction problem audit-log
// entries already have to solve (see shared/audit/redaction.ts, #702).

/** Options every exported client function accepts for logging/correlation. */
export interface ClientCallOptions {
  /**
   * The calling agent's requestId, threaded through so this call's log
   * lines can be correlated with the agent run / audit-log entry that
   * triggered it. Optional: not every caller has one available to pass
   * yet — a betaZodTool's `run(input)` closure (see e.g.
   * discovery.tools.ts) has no access to the agent's AgentRunRequest
   * today, so tool-driven calls currently log without it.
   */
  requestId?: string;
}

interface CallContext {
  /** Distinguishes which exported function a log line came from, since
   *  they all share this same logging path. */
  operation: string;
  method: string;
  path: string;
  requestId?: string;
}

/**
 * Retries `fn` on a transient network/5xx failure with exponential
 * backoff, logging a distinct line on each retry attempt (attempt number,
 * the error that triggered it) so a retried call is distinguishable in
 * logs from one that succeeded on the first try. Returns how many
 * attempts it actually took alongside the result — 1 means no retry
 * occurred.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: CallContext,
): Promise<{ value: T; attempts: number }> {
  let attempt = 0;
  for (;;) {
    try {
      const value = await fn();
      return { value, attempts: attempt + 1 };
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryableError(err)) {
        throw err;
      }
      logger.warn(
        {
          ...context,
          event: "retry",
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          error: errorMessage(err),
        },
        "corporate-platform client request retry",
      );
      await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
      attempt += 1;
    }
  }
}

/**
 * Logs request-start and response-complete (or failure) around `fn`, with
 * method/path/duration/outcome — never the request or response body, by
 * design (see the section comment above). `fn` is expected to return the
 * raw axios response; callers do their own schema parsing (and, on a
 * validation failure, their own shape-summary logging) afterward.
 */
async function requestWithLogging(
  context: CallContext,
  fn: () => Promise<AxiosResponse>,
): Promise<AxiosResponse> {
  const start = Date.now();
  logger.info(
    { ...context, event: "request_start" },
    "corporate-platform client request start",
  );

  try {
    const { value: response, attempts } = await withRetry(fn, context);
    logger.info(
      {
        ...context,
        event: "request_complete",
        outcome: "success",
        status: response.status,
        attempts,
        retried: attempts > 1,
        durationMs: Date.now() - start,
      },
      "corporate-platform client request complete",
    );
    return response;
  } catch (err) {
    logger.error(
      {
        ...context,
        event: "request_complete",
        outcome: "error",
        status: axios.isAxiosError(err) ? err.response?.status : undefined,
        durationMs: Date.now() - start,
        error: errorMessage(err),
      },
      "corporate-platform client request failed",
    );
    throw err;
  }
}

/**
 * A truncated, non-sensitive view of a response body that failed schema
 * validation: top-level keys only (or type/length for an array or
 * primitive), never full values — enough to diagnose a backend contract
 * change (a renamed/missing/retyped field) without risking a dump of
 * potentially sensitive portfolio data into logs.
 */
function summarizeResponseShape(data: unknown): unknown {
  if (Array.isArray(data)) {
    return { type: "array", length: data.length };
  }
  if (data !== null && typeof data === "object") {
    return { type: "object", keys: Object.keys(data) };
  }
  return { type: typeof data };
}

/**
 * Fetch a company's current carbon credit portfolio.
 *
 * Request: `GET /api/v1/portfolio/:companyId` on corporate-platform-backend.
 * Response body (on success): `{ success: true, data: Portfolio, timestamp }`
 * where `Portfolio` is `{ companyId, totalRetired, currentBalance,
 * totalValue, avgPricePerTon, riskRating, holdings: PortfolioHolding[] }`.
 *
 * Retries once transient network errors or 5xx responses up to
 * {@link MAX_RETRIES} times with exponential backoff; 4xx responses and
 * schema-validation failures are not retried and reject immediately.
 *
 * Logs a request-start and request-complete/failed line (method, path,
 * duration, attempts, outcome — never the body), a distinct line per
 * retry attempt, and, on a schema-validation failure, the response status
 * plus a truncated shape summary of the unparseable body (#706). Pass
 * `options.requestId` to correlate these log lines with the agent run
 * that triggered the call, when the caller has one available.
 *
 * @throws {z.ZodError} if the response body doesn't match the expected
 * portfolio shape — this is treated as a hard failure rather than passed
 * through unvalidated.
 */
async function getPortfolio(
  companyId: string,
  options: ClientCallOptions = {},
): Promise<Portfolio> {
  const context: CallContext = {
    operation: "getPortfolio",
    method: "GET",
    path: `/api/v1/portfolio/${encodeURIComponent(companyId)}`,
    requestId: options.requestId,
  };

  const response = await requestWithLogging(context, () =>
    http.get(context.path),
  );

  const result = PortfolioResponseSchema.safeParse(response.data);
  if (!result.success) {
    logger.error(
      {
        ...context,
        event: "schema_validation_failed",
        status: response.status,
        responseShape: summarizeResponseShape(response.data),
        error: result.error.message,
      },
      "corporate-platform client response failed schema validation",
    );
    throw result.error;
  }
  return result.data.data;
}

export const corporatePlatformClient = {
  http,
  getPortfolio,
};
