import { beforeEach, describe, expect, it, vi } from "vitest";

const getPortfolioMock = vi.fn();
vi.mock("../../clients/corporate-platform.client.js", () => ({
  corporatePlatformClient: {
    getPortfolio: (...args: unknown[]) => getPortfolioMock(...args),
  },
}));

const { getBuyerPortfolio, discoveryTools } =
  await import("./discovery.tools.js");

describe("getBuyerPortfolio tool", () => {
  beforeEach(() => {
    getPortfolioMock.mockReset();
  });

  it("is registered in discoveryTools", () => {
    expect(discoveryTools.map((t) => t.name)).toContain("get_buyer_portfolio");
  });

  it("calls corporatePlatformClient.getPortfolio with the given companyId and returns it as JSON", async () => {
    const portfolio = { companyId: "co-1", holdings: [] };
    getPortfolioMock.mockResolvedValue(portfolio);

    const result = await getBuyerPortfolio.run({ companyId: "co-1" });

    expect(getPortfolioMock).toHaveBeenCalledWith("co-1");
    expect(JSON.parse(result as string)).toEqual(portfolio);
  });
});
