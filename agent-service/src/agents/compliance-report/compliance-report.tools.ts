import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { corporatePlatformClient } from "../../clients/corporate-platform.client.js";

// Compliance-report drafting agent tools — assembles evidence from
// retirement-analytics/portfolio/audit-trail and drafts CSRD/CBAM/CORSIA/
// SBTi/GHG Protocol report narratives for human review.
//
// getPortfolio (issue #581) covers the portfolio-composition slice of this
// evidence bundle. Retirement-history and audit-trail entries still have
// no corresponding corporatePlatformClient method — tracked separately —
// so this tool reports those as a gap in `notes` rather than fabricating
// or silently omitting them.
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
    const portfolio = await corporatePlatformClient.getPortfolio(
      input.companyId,
    );
    return JSON.stringify({
      companyId: input.companyId,
      framework: input.framework,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      portfolio,
      notes:
        "Retirement history and audit-trail entries are not yet available from corporatePlatformClient (tracked separately) — only portfolio composition is included here.",
    });
  },
});

export const complianceReportTools = [getCompanyRetirementEvidence];
