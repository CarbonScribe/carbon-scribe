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
import { mockMarketplaceCreditsResponseBody } from "./corporate-platform.client.fixtures.js";

// Thin HTTP client for corporate-platform-backend (NestJS). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the remaining endpoints agent tools need, e.g.:
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

// ---------------------------------------------------------------------------
// listMarketplaceCredits
// ---------------------------------------------------------------------------

/** Query filters accepted by listMarketplaceCredits, mirroring SearchQueryDto. */
export interface MarketplaceCreditFilters {
  query?: string;
  projectName?: string;
  country?: string;
  methodology?: string;
  standard?: string;
  sdgs?: number[];
  vintageFrom?: number;
  vintageTo?: number;
  priceMin?: number;
  priceMax?: number;
  sortBy?: "price" | "vintage" | "popularity" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Error thrown when corporate-platform-backend responds with 429 Too Many Requests.
 * Extracts Retry-After header seconds if present.
 */
export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    public readonly response?: {
      status: number;
      headers?: Record<string, unknown>;
    },
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const MarketplaceCreditSchema = z.object({
  id: z.string(),
  companyId: z.string().nullable().optional(),
  projectId: z.string(),
  projectName: z.string(),
  pricePerTon: z.number(),
  availableAmount: z.number(),
  totalAmount: z.number(),
  status: z.string().optional(),
  dynamicScore: z.number().optional(),
  verificationScore: z.number().optional(),
  additionalityScore: z.number().optional(),
  permanenceScore: z.number().optional(),
  leakageScore: z.number().optional(),
  cobenefitsScore: z.number().optional(),
  transparencyScore: z.number().optional(),
  methodology: z.string().nullable().optional(),
  vintage: z.number().int().nullable().optional(),
  verificationStandard: z.string().nullable().optional(),
  lastVerification: z.coerce.date().nullable().optional(),
  country: z.string().nullable().optional(),
  sdgs: z.array(z.number()).optional().default([]),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const MarketplaceFacetValueSchema = z.object({
  value: z.union([z.string(), z.number()]),
  count: z.number(),
});

export const MarketplaceFacetsSchema = z.object({
  countries: z.array(MarketplaceFacetValueSchema).optional().default([]),
  methodologies: z.array(MarketplaceFacetValueSchema).optional().default([]),
  standards: z.array(MarketplaceFacetValueSchema).optional().default([]),
  sdgs: z.array(MarketplaceFacetValueSchema).optional().default([]),
  vintageYears: z.array(MarketplaceFacetValueSchema).optional().default([]),
  priceRange: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      median: z.number().optional(),
    })
    .optional()
    .default({}),
});

export const MarketplaceSearchResponseSchema = z.object({
  data: z.array(MarketplaceCreditSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  facets: MarketplaceFacetsSchema.optional().default({}),
});

export type MarketplaceCredit = z.infer<typeof MarketplaceCreditSchema>;
export type MarketplaceSearchFacets = z.infer<typeof MarketplaceFacetsSchema>;
export type MarketplaceSearchResult = z.infer<
  typeof MarketplaceSearchResponseSchema
>;

/**
 * Builds URLSearchParams from MarketplaceCreditFilters, serialising array
 * values (such as sdgs) as repeated parameters.
 */
export function buildMarketplaceSearchParams(
  filters: MarketplaceCreditFilters = {},
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          params.append(key, String(item));
        }
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}

/**
 * Search available marketplace credits.
 *
 * Request: `GET /api/v1/marketplace/search` on corporate-platform-backend.
 * Accepts filters mapping to SearchQueryDto, serialising array query parameters as repeated keys.
 * Returns validated `{ data, total, page, limit, facets }`.
 * Rate limit (429) responses are surfaced as a typed {@link RateLimitExceededError}.
 */
async function listMarketplaceCredits(
  filters: MarketplaceCreditFilters = {},
  options: ClientCallOptions & { mock?: boolean } = {},
): Promise<MarketplaceSearchResult> {
  if (env.mockCorporatePlatform || options.mock) {
    return MarketplaceSearchResponseSchema.parse(
      mockMarketplaceCreditsResponseBody,
    );
  }

  const params = buildMarketplaceSearchParams(filters);
  const queryString = params.toString();
  const path = queryString
    ? `/api/v1/marketplace/search?${queryString}`
    : `/api/v1/marketplace/search`;

  const context: CallContext = {
    clientName: "corporate-platform",
    operation: "listMarketplaceCredits",
    method: "GET",
    path,
    requestId: options.requestId,
  };

  let response;
  try {
    response = await requestWithLogging(context, () => http.get(context.path));
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      const retryAfterHeader =
        err.response.headers?.["retry-after"] ??
        err.response.headers?.["Retry-After"];
      let retryAfterSeconds: number | undefined;
      if (typeof retryAfterHeader === "string") {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed)) {
          retryAfterSeconds = parsed;
        }
      } else if (typeof retryAfterHeader === "number") {
        retryAfterSeconds = retryAfterHeader;
      }
      throw new RateLimitExceededError(
        `Marketplace search rate limit exceeded (429)${retryAfterSeconds !== undefined ? `, retry after ${retryAfterSeconds}s` : ""}`,
        err.response as any,
        retryAfterSeconds,
      );
    }
    throw err;
  }

  const result = MarketplaceSearchResponseSchema.safeParse(response.data);
  if (!result.success) {
    logSchemaValidationError(
      context,
      response.status,
      response.data,
      result.error,
    );
    throw result.error;
  }
  return result.data;
}

export const corporatePlatformClient = {
  http,
  getPortfolio,
  listMarketplaceCredits,
};
