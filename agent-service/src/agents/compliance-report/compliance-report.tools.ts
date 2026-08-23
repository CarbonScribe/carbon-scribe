import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { corporatePlatformClient } from "../../clients/corporate-platform.client.js";

// Compliance-report drafting agent tools — assembles evidence from
// retirement-analytics/portfolio/audit-trail and drafts CSRD/CBAM/CORSIA/
// SBTi/GHG Protocol report narratives for human review.
//
// TODO: replace with the real portfolio + retirement-history endpoints.
export const getCompanyRetirementEvidence = betaZodTool({
  name: "get_company_retirement_evidence",
  description:
    "Fetch a company's retirement records, portfolio composition, and prior audit-trail entries needed to populate a compliance report for a given framework and reporting period.",
  inputSchema: z.object({
    companyId: z.string(),
    framework: z.enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"]),
    periodStart: z.string(),
    periodEnd: z.string(),
  }),
  run: async (input) => {
    void corporatePlatformClient; // TODO: wire real call, remove this line
    void input;
    throw new Error("not implemented");
  },
});

export const complianceReportTools = [getCompanyRetirementEvidence];
