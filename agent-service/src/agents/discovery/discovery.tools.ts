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

export const discoveryTools = [searchMarketplaceCredits];
