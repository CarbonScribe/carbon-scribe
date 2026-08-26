import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { corporatePlatformClient } from "../../clients/corporate-platform.client.js";

// Credit-discovery agent tools — corporate-platform's
// marketplace/discovery-engine.service.ts is the natural home for the
// business logic this calls into; this tool is the thin bridge.
//
// TODO: replace with the real marketplace search endpoint once it exists.
export const searchMarketplaceCredits = betaZodTool({
  name: "search_marketplace_credits",
  description:
    "Search available carbon credits on the marketplace, filtered by buyer criteria (methodology, vintage, price range, co-benefits, compliance framework).",
  inputSchema: z.object({
    methodology: z.string().optional(),
    maxPricePerTonne: z.number().optional(),
    complianceFramework: z
      .enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"])
      .optional(),
  }),
  run: async (input) => {
    void corporatePlatformClient; // TODO: wire real call, remove this line
    void input;
    throw new Error("not implemented");
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
