import type { Portfolio } from "./corporate-platform.client.js";

// Sample fixture data for exercising corporatePlatformClient.getPortfolio()
// without a live corporate-platform-backend instance — used by this
// client's own tests and available to any agent-tool test that needs a
// stand-in portfolio response.

/** The raw wire-shape response body corporate-platform-backend would send. */
export const mockPortfolioResponseBody = {
  success: true,
  data: {
    companyId: "company-fixture-1",
    totalRetired: 1200,
    currentBalance: 340,
    totalValue: 18700.5,
    avgPricePerTon: 15.25,
    riskRating: "Low",
    holdings: [
      {
        creditId: "credit-1",
        projectId: "project-1",
        projectName: "Amazon Basin Reforestation",
        methodology: "REDD+",
        vintage: 2024,
        quantity: 200,
        currentValue: 3200,
      },
      {
        creditId: "credit-2",
        projectId: "project-2",
        projectName: "Kenyan Biochar Cooperative",
        methodology: "biochar",
        vintage: 2023,
        quantity: 140,
        currentValue: 2100,
      },
    ],
  },
  timestamp: "2026-08-26T00:00:00.000Z",
};

/** The parsed, typed value corporatePlatformClient.getPortfolio() should resolve to. */
export const mockPortfolio: Portfolio = mockPortfolioResponseBody.data;
