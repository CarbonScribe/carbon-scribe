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

// Framework-specific minimum period length requirements (in days)
const FRAMEWORK_MIN_PERIOD_DAYS: Record<string, number> = {
  csrd: 364, // Annual reporting (allow for non-leap years)
  cbam: 89, // Quarterly reporting (allow for ~3 months)
  corsia: 89, // Quarterly reporting (allow for ~3 months)
  sbti: 364, // Annual reporting (allow for non-leap years)
  "ghg-protocol": 364, // Annual reporting (allow for non-leap years)
};

// Export the schema separately for testing
export const getCompanyRetirementEvidenceSchema = z
  .object({
    companyId: z.string(),
    framework: z.enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"]),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
  })
  .refine(
    (input) => {
      const start = new Date(input.periodStart);
      const end = new Date(input.periodEnd);
      return end > start;
    },
    {
      message: "periodEnd must be strictly after periodStart",
      path: ["periodEnd"],
    },
  )
  .refine(
    (input) => {
      const start = new Date(input.periodStart);
      const end = new Date(input.periodEnd);
      const periodDays = Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      const minDays = FRAMEWORK_MIN_PERIOD_DAYS[input.framework];
      return periodDays >= minDays;
    },
    {
      message: (input) =>
        `Period length does not meet the minimum requirement for ${input.framework} framework`,
      path: ["periodEnd"],
    },
  );

export const getCompanyRetirementEvidence = betaZodTool({
  name: "get_company_retirement_evidence",
  description:
    "Fetch a company's retirement records, portfolio composition, and prior audit-trail entries needed to populate a compliance report for a given framework and reporting period.",
  inputSchema: getCompanyRetirementEvidenceSchema,
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
