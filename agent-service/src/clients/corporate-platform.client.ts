import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";

// Thin HTTP client for corporate-platform-backend (NestJS). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the remaining endpoints agent tools need, e.g.:
//   - listMarketplaceCredits(filters)
//   - getComplianceFramework(framework: "csrd" | "cbam" | "corsia" | "sbti" | "ghg-protocol")
//   - getRetirementHistory(companyId)
// Outbound auth (agent-service authenticating itself to
// corporate-platform-backend) is a separate, not-yet-specified concern —
// out of scope for issue #579, which replaced the shared-secret check on
// agent-service's own inbound routes (see
// shared/middleware/auth.middleware.ts). corporate-platform-backend has no
// service-to-service auth guard today regardless of what header this
// client sends, so there is nothing to authenticate against yet.
const http = axios.create({
  baseURL: env.corporatePlatformBaseUrl,
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
 * @throws {z.ZodError} if the response body doesn't match the expected
 * portfolio shape — this is treated as a hard failure rather than passed
 * through unvalidated.
 */
async function getPortfolio(companyId: string): Promise<Portfolio> {
  const response = await withRetry(() =>
    http.get(`/api/v1/portfolio/${encodeURIComponent(companyId)}`),
  );
  const parsed = PortfolioResponseSchema.parse(response.data);
  return parsed.data;
}

export const corporatePlatformClient = {
  http,
  getPortfolio,
};
