import axios from "axios";
import { env } from "../config/env.js";

// Thin HTTP client for corporate-platform-backend (NestJS). Agent tools call
// through here rather than hitting axios directly, so auth/base-URL/retry
// logic lives in one place.
//
// TODO: add the actual endpoints agent tools need, e.g.:
//   - getPortfolio(companyId)
//   - listMarketplaceCredits(filters)
//   - getComplianceFramework(framework: "csrd" | "cbam" | "corsia" | "sbti" | "ghg-protocol")
//   - getRetirementHistory(companyId)
const http = axios.create({
  baseURL: env.corporatePlatformBaseUrl,
  headers: env.internalServiceToken
    ? { "x-internal-token": env.internalServiceToken }
    : undefined,
});

export const corporatePlatformClient = {
  http,
};
