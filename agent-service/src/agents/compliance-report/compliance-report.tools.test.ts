import { beforeEach, describe, expect, it, vi } from "vitest";

const getPortfolioMock = vi.fn();
vi.mock("../../clients/corporate-platform.client.js", () => ({
  corporatePlatformClient: {
    getPortfolio: (...args: unknown[]) => getPortfolioMock(...args),
  },
}));

const { getCompanyRetirementEvidence, complianceReportTools } =
  await import("./compliance-report.tools.js");

describe("getCompanyRetirementEvidence tool", () => {
  beforeEach(() => {
    getPortfolioMock.mockReset();
  });

  it("is registered in complianceReportTools", () => {
    expect(complianceReportTools.map((t) => t.name)).toContain(
      "get_company_retirement_evidence",
    );
  });

  it("calls corporatePlatformClient.getPortfolio and includes it in the returned evidence bundle", async () => {
    const portfolio = { companyId: "co-1", holdings: [] };
    getPortfolioMock.mockResolvedValue(portfolio);

    const result = await getCompanyRetirementEvidence.run({
      companyId: "co-1",
      framework: "csrd",
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
    });

    expect(getPortfolioMock).toHaveBeenCalledWith("co-1");
    const parsed = JSON.parse(result as string);
    expect(parsed.portfolio).toEqual(portfolio);
    expect(parsed.framework).toBe("csrd");
    // Retirement-history/audit-trail methods don't exist yet — the gap
    // must be surfaced, not silently dropped.
    expect(parsed.notes).toContain("tracked separately");
  });
});
