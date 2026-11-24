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

export const mockMarketplaceSearchResult = {
  data: [
    {
      id: "credit-fixture-1",
      projectId: "project-fixture-1",
      projectName: "Amazon Basin Reforestation",
      pricePerTon: 14.25,
      availableAmount: 500,
      status: "available",
      methodology: "REDD+",
      vintage: 2024,
      verificationStandard: "VCS",
      country: "Brazil",
      sdgs: [13, 15],
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  facets: {
    countries: [{ value: "Brazil", count: 1 }],
    methodologies: [{ value: "REDD+", count: 1 }],
    standards: [{ value: "VCS", count: 1 }],
    sdgs: [
      { value: 13, count: 1 },
      { value: 15, count: 1 },
    ],
    vintageYears: [{ value: 2024, count: 1 }],
    priceRange: { min: 14.25, max: 14.25, median: 14.25 },
  },
};
