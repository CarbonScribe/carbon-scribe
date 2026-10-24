import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";
import { signServiceToken } from "../shared/auth/service-token.js";
import {
  type ClientCallOptions,
  type CallContext,
  requestWithLogging,
  logSchemaValidationError,
} from "./http-client.helper.js";

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
export type { ClientCallOptions };

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
    clientName: "corporate-platform",
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
    logSchemaValidationError(
      context,
      response.status,
      response.data,
      result.error,
    );
    throw result.error;
  }
  return result.data.data;
}

export const corporatePlatformClient = {
  http,
  getPortfolio,
};
