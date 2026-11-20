import { beforeEach, describe, expect, it, vi } from "vitest";

const getPortfolioMock = vi.fn();
vi.mock("../../clients/corporate-platform.client.js", () => ({
  corporatePlatformClient: {
    getPortfolio: (...args: unknown[]) => getPortfolioMock(...args),
  },
}));

const {
  getCompanyRetirementEvidence,
  getCompanyRetirementEvidenceSchema,
  complianceReportTools,
} = await import("./compliance-report.tools.js");

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

  describe("input schema validation", () => {
    it("rejects malformed date strings for periodStart", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "csrd",
        periodStart: "not-a-date",
        periodEnd: "2026-12-31",
      });
      expect(result.success).toBe(false);
    });

    it("rejects malformed date strings for periodEnd", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "csrd",
        periodStart: "2026-01-01",
        periodEnd: "invalid-date",
      });
      expect(result.success).toBe(false);
    });

    it("rejects inverted period where periodEnd is before periodStart", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "csrd",
        periodStart: "2026-12-31",
        periodEnd: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects period where periodEnd equals periodStart", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "csrd",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects CSRD period shorter than 364 days", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "csrd",
        periodStart: "2026-01-01",
        periodEnd: "2026-06-30", // ~180 days
      });
      expect(result.success).toBe(false);
    });

    it("rejects SBTi period shorter than 364 days", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "sbti",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31", // ~90 days
      });
      expect(result.success).toBe(false);
    });

    it("rejects GHG Protocol period shorter than 364 days", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "ghg-protocol",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-28", // ~58 days
      });
      expect(result.success).toBe(false);
    });

    it("rejects CBAM period shorter than 89 days", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "cbam",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-28", // ~58 days
      });
      expect(result.success).toBe(false);
    });

    it("rejects CORSIA period shorter than 89 days", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "corsia",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-28", // ~58 days
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid CSRD period (364+ days)", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "csrd",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid SBTi period (364+ days)", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "sbti",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid GHG Protocol period (364+ days)", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "ghg-protocol",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid CBAM period (89+ days)", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "cbam",
        periodStart: "2026-01-01",
        periodEnd: "2026-04-01", // ~90 days
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid CORSIA period (89+ days)", () => {
      const result = getCompanyRetirementEvidenceSchema.safeParse({
        companyId: "co-1",
        framework: "corsia",
        periodStart: "2026-01-01",
        periodEnd: "2026-04-01", // ~90 days
      });
      expect(result.success).toBe(true);
    });
  });
});
