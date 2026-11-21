import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  corporatePlatformClient,
  type MarketplaceCreditFilters,
} from "../../clients/corporate-platform.client.js";

const MAX_SEARCH_LIMIT = 20;

/**
 * Maps compliance frameworks to verification standards accepted by corporate-platform-backend:
 * - "corsia" -> "VCS" (Verified Carbon Standard is eligible under CORSIA Phase 1)
 * - "csrd" -> "Gold Standard" (European CSRD ESRS E1 recommends high-permanence standards)
 * - "sbti" -> "Gold Standard" (SBTi BVCM encourages premium permanence credits)
 * - "cbam" / "ghg-protocol" -> no direct single-standard constraint; left unrestricted for backend search
 */
function mapComplianceFrameworkToStandard(
  framework?: "csrd" | "cbam" | "corsia" | "sbti" | "ghg-protocol",
): string | undefined {
  if (!framework) return undefined;
  switch (framework) {
    case "corsia":
      return "VCS";
    case "csrd":
    case "sbti":
      return "Gold Standard";
    case "cbam":
    case "ghg-protocol":
    default:
      return undefined;
  }
}

// Credit-discovery agent tools — corporate-platform's
// marketplace/discovery-engine.service.ts is the natural home for the
// business logic this calls into; this tool is the thin bridge.
export const searchMarketplaceCredits = betaZodTool({
  name: "search_marketplace_credits",
  description:
    "Search available carbon credits on the marketplace, filtered by buyer criteria (methodology, vintage, price range, co-benefits, compliance framework).",
  inputSchema: z.object({
    methodology: z.string().optional(),
    maxPricePerTonne: z.number().optional(),
    country: z.string().optional(),
    vintageFrom: z.number().int().optional(),
    vintageTo: z.number().int().optional(),
    sdgs: z.array(z.number().int()).optional(),
    limit: z.number().int().positive().optional().default(10),
    complianceFramework: z
      .enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"])
      .optional(),
  }),
  run: async (input) => {
    const cappedLimit = Math.min(input.limit ?? 10, MAX_SEARCH_LIMIT);
    const standard = mapComplianceFrameworkToStandard(
      input.complianceFramework,
    );

    const filters: MarketplaceCreditFilters = {
      methodology: input.methodology,
      priceMax: input.maxPricePerTonne,
      country: input.country,
      vintageFrom: input.vintageFrom,
      vintageTo: input.vintageTo,
      sdgs: input.sdgs,
      standard,
      limit: cappedLimit,
    };

    try {
      const results =
        await corporatePlatformClient.listMarketplaceCredits(filters);

      if (!results || results.total === 0 || results.data.length === 0) {
        return JSON.stringify({
          credits: [],
          total: 0,
          message: "No marketplace credits found matching the criteria.",
        });
      }

      const credits = results.data.slice(0, cappedLimit).map((c) => ({
        creditId: c.id,
        projectName: c.projectName,
        methodology: c.methodology ?? null,
        vintage: c.vintage ?? null,
        country: c.country ?? null,
        pricePerTonne: c.pricePerTon,
        available: c.availableAmount,
      }));

      return JSON.stringify({
        credits,
        total: results.total,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        error: `marketplace search unavailable: ${msg}`,
        credits: [],
        total: 0,
      });
    }
  },
});

// Buyer-preference lookup (issue #581) — grounds a recommendation in the
// buyer's existing holdings/diversification instead of shortlisting purely
// off the marketplace search above.
export const getBuyerPortfolio = betaZodTool({
  name: "get_buyer_portfolio",
  description:
    "Fetch a buyer's current carbon credit portfolio (summary metrics and holdings) to ground credit recommendations in their existing diversification, risk profile, and prior purchases.",
  inputSchema: z.object({
    companyId: z.string(),
  }),
  run: async (input) => {
    const portfolio = await corporatePlatformClient.getPortfolio(
      input.companyId,
    );
    return JSON.stringify(portfolio);
  },
});

export const discoveryTools = [searchMarketplaceCredits, getBuyerPortfolio];
