import type {
  Portfolio,
  MarketplaceSearchResult,
} from "./corporate-platform.client.js";

// Sample fixture data for exercising corporatePlatformClient.getPortfolio()
// and corporatePlatformClient.listMarketplaceCredits() without a live
// corporate-platform-backend instance.

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

/** A mock credit item in the marketplace search results. */
export const mockMarketplaceCreditItem = {
  id: "credit-fixture-1",
  companyId: "company-fixture-1",
  projectId: "project-fixture-1",
  projectName: "Amazon Basin Reforestation",
  pricePerTon: 15.5,
  availableAmount: 1200,
  totalAmount: 5000,
  status: "available",
  dynamicScore: 92,
  verificationScore: 95,
  additionalityScore: 90,
  permanenceScore: 88,
  leakageScore: 85,
  cobenefitsScore: 94,
  transparencyScore: 96,
  methodology: "REDD+",
  vintage: 2024,
  verificationStandard: "VCS",
  country: "Brazil",
  sdgs: [13, 15],
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-01-15T00:00:00.000Z",
};

export const mockMarketplaceCreditItem2 = {
  id: "credit-fixture-2",
  companyId: "company-fixture-2",
  projectId: "project-fixture-2",
  projectName: "Kenyan Biochar Cooperative",
  pricePerTon: 22.0,
  availableAmount: 450,
  totalAmount: 1000,
  status: "available",
  dynamicScore: 88,
  verificationScore: 90,
  additionalityScore: 86,
  permanenceScore: 92,
  leakageScore: 80,
  cobenefitsScore: 89,
  transparencyScore: 91,
  methodology: "biochar",
  vintage: 2023,
  verificationStandard: "Gold Standard",
  country: "Kenya",
  sdgs: [2, 13, 15],
  createdAt: "2026-02-10T00:00:00.000Z",
  updatedAt: "2026-02-10T00:00:00.000Z",
};

/** The raw wire-shape response body corporate-platform-backend's search endpoint would return. */
export const mockMarketplaceCreditsResponseBody = {
  data: [mockMarketplaceCreditItem, mockMarketplaceCreditItem2],
  total: 2,
  page: 1,
  limit: 10,
  facets: {
    countries: [
      { value: "Brazil", count: 1 },
      { value: "Kenya", count: 1 },
    ],
    methodologies: [
      { value: "REDD+", count: 1 },
      { value: "biochar", count: 1 },
    ],
    standards: [
      { value: "VCS", count: 1 },
      { value: "Gold Standard", count: 1 },
    ],
    sdgs: [
      { value: 13, count: 2 },
      { value: 15, count: 2 },
      { value: 2, count: 1 },
    ],
    vintageYears: [
      { value: 2024, count: 1 },
      { value: 2023, count: 1 },
    ],
    priceRange: {
      min: 15.5,
      max: 22.0,
      median: 18.75,
    },
  },
};

/** The parsed, typed value corporatePlatformClient.listMarketplaceCredits() resolves to. */
export const mockMarketplaceCreditsResult: MarketplaceSearchResult = {
  data: [
    {
      ...mockMarketplaceCreditItem,
      lastVerification: null,
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
      updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    },
    {
      ...mockMarketplaceCreditItem2,
      lastVerification: null,
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
  facets: mockMarketplaceCreditsResponseBody.facets,
};
