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

    it("calls corporatePlatformClient.listMarketplaceCredits with mapped filters and returns results as JSON", async () => {
      const searchResult = {
        data: [{ id: "credit-1", projectName: "Forest" }],
        total: 1,
        page: 1,
        limit: 10,
        facets: {},
      };
      listMarketplaceCreditsMock.mockResolvedValue(searchResult);

      const result = await searchMarketplaceCredits.run({
        methodology: "REDD+",
        maxPricePerTonne: 50,
      });

      expect(listMarketplaceCreditsMock).toHaveBeenCalledWith({
        methodology: "REDD+",
        priceMax: 50,
      });
      expect(JSON.parse(result as string)).toEqual(searchResult);
    });
  });
});
