import { beforeEach, describe, expect, it, vi } from "vitest";

const getPortfolioMock = vi.fn();
const listMarketplaceCreditsMock = vi.fn();
vi.mock("../../clients/corporate-platform.client.js", () => ({
  corporatePlatformClient: {
    getPortfolio: (...args: unknown[]) => getPortfolioMock(...args),
    listMarketplaceCredits: (...args: unknown[]) =>
      listMarketplaceCreditsMock(...args),
  },
}));

const { getBuyerPortfolio, searchMarketplaceCredits, discoveryTools } =
  await import("./discovery.tools.js");

describe("discoveryTools", () => {
  beforeEach(() => {
    getPortfolioMock.mockReset();
    listMarketplaceCreditsMock.mockReset();
  });

  describe("getBuyerPortfolio tool", () => {
    it("is registered in discoveryTools", () => {
      expect(discoveryTools.map((t) => t.name)).toContain(
        "get_buyer_portfolio",
      );
    });

    it("calls corporatePlatformClient.getPortfolio with the given companyId and returns it as JSON", async () => {
      const portfolio = { companyId: "co-1", holdings: [] };
      getPortfolioMock.mockResolvedValue(portfolio);

      const result = await getBuyerPortfolio.run({ companyId: "co-1" });

      expect(getPortfolioMock).toHaveBeenCalledWith("co-1");
      expect(JSON.parse(result as string)).toEqual(portfolio);
    });
  });

  describe("searchMarketplaceCredits tool", () => {
    it("is registered in discoveryTools", () => {
      expect(discoveryTools.map((t) => t.name)).toContain(
        "search_marketplace_credits",
      );
    });

    it("maps buyer criteria and complianceFramework to backend filters and returns compact projection (#836)", async () => {
      const searchResult = {
        data: [
          {
            id: "credit-1",
            projectName: "Amazon Basin Reforestation",
            methodology: "REDD+",
            vintage: 2024,
            country: "Brazil",
            pricePerTon: 15.5,
            availableAmount: 1200,
            totalAmount: 5000,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        facets: {},
      };
      listMarketplaceCreditsMock.mockResolvedValue(searchResult);

      const result = await searchMarketplaceCredits.run({
        methodology: "REDD+",
        maxPricePerTonne: 50,
        country: "Brazil",
        vintageFrom: 2020,
        vintageTo: 2025,
        sdgs: [13, 15],
        complianceFramework: "corsia",
        limit: 10,
      });

      // Verify filter mapping (corsia -> VCS, maxPricePerTonne -> priceMax)
      expect(listMarketplaceCreditsMock).toHaveBeenCalledWith({
        methodology: "REDD+",
        priceMax: 50,
        country: "Brazil",
        vintageFrom: 2020,
        vintageTo: 2025,
        sdgs: [13, 15],
        standard: "VCS",
        limit: 10,
      });

      // Verify compact projection with creditId and pricePerTonne
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual({
        credits: [
          {
            creditId: "credit-1",
            projectName: "Amazon Basin Reforestation",
            methodology: "REDD+",
            vintage: 2024,
            country: "Brazil",
            pricePerTonne: 15.5,
            available: 1200,
          },
        ],
        total: 1,
      });
    });

    it("caps limit at 20 when caller requests a higher number", async () => {
      listMarketplaceCreditsMock.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        facets: {},
      });

      await searchMarketplaceCredits.run({ limit: 50 });

      expect(listMarketplaceCreditsMock).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20 }),
      );
    });

    it("returns structured no-results payload when search returns empty", async () => {
      listMarketplaceCreditsMock.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        facets: {},
      });

      const result = await searchMarketplaceCredits.run({
        methodology: "nonexistent",
      });

      const parsed = JSON.parse(result as string);
      expect(parsed.total).toBe(0);
      expect(parsed.credits).toEqual([]);
      expect(parsed.message).toContain("No marketplace credits found");
    });

    it("returns structured error payload on upstream client failure without throwing", async () => {
      listMarketplaceCreditsMock.mockRejectedValue(
        new Error("Connection refused to backend"),
      );

      const result = await searchMarketplaceCredits.run({ country: "Kenya" });

      const parsed = JSON.parse(result as string);
      expect(parsed.error).toContain("marketplace search unavailable");
      expect(parsed.error).toContain("Connection refused to backend");
      expect(parsed.credits).toEqual([]);
      expect(parsed.total).toBe(0);
    });
  });
});
