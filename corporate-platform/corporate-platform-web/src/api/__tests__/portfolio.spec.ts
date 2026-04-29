/**
 * Tests for Portfolio API
 */

import { portfolioAPI } from "@/api/portfolio";
import { apiClient, ApiErrorClass } from "@/api/client";
import type { PortfolioSummary, PaginatedHoldings } from "@/api/types";

jest.mock("@/api/client");

describe("PortfolioAPI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPortfolioSummary", () => {
    it("should fetch portfolio summary successfully", async () => {
      const mockSummary: PortfolioSummary = {
        totalRetired: 1000,
        availableBalance: 500,
        quarterlyGrowth: 15.5,
        netZeroProgress: 65,
        scope3Coverage: 45,
        sdgAlignment: 80,
        costEfficiency: 2.5,
        lastUpdatedAt: new Date().toISOString(),
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockSummary,
      });

      const result = await portfolioAPI.getPortfolioSummary();

      expect(apiClient.get).toHaveBeenCalledWith("/portfolio/summary");
      expect(result).toEqual(mockSummary);
    });

    it("should handle API errors gracefully", async () => {
      const error = new ApiErrorClass("Network error", 0, "NETWORK_ERROR");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      try {
        await portfolioAPI.getPortfolioSummary();
        fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiErrorClass);
      }
    });
  });

  describe("getHoldings", () => {
    it("should fetch holdings with pagination", async () => {
      const mockHoldings: PaginatedHoldings = {
        holdings: [
          {
            id: "1",
            creditId: "c1",
            companyId: "comp1",
            creditAmount: 100,
            purchasePrice: 15.5,
            purchaseDate: new Date().toISOString(),
            currentValue: 1550,
            status: "available",
            credit: {
              projectName: "Test Project",
              methodology: "VERRA",
              country: "Brazil",
              vintage: 2023,
              verificationStandard: "VERRA",
              sdgs: ["SDG13"],
              qualityMetrics: {
                dynamicScore: 85,
                verificationScore: 90,
                additionalityScore: 80,
                permanenceScore: 95,
                leakageScore: 88,
                cobenefitsScore: 85,
                transparencyScore: 92,
              },
            },
          },
        ],
        total: 100,
        page: 1,
        pageSize: 10,
        totalPages: 10,
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockHoldings,
      });

      const result = await portfolioAPI.getHoldings({ page: 1, pageSize: 10 });

      expect(apiClient.get).toHaveBeenCalledWith(
        "/portfolio/holdings?page=1&pageSize=10",
      );
      expect(result).toEqual(mockHoldings);
      expect(result.holdings.length).toBe(1);
    });

    it("should handle empty holdings", async () => {
      const mockEmpty: PaginatedHoldings = {
        holdings: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockEmpty,
      });

      const result = await portfolioAPI.getHoldings();

      expect(result.holdings.length).toBe(0);
    });
  });

  describe("getPerformanceAnalytics", () => {
    it("should fetch performance analytics", async () => {
      const mockPerformance = {
        portfolioValue: 15500,
        avgPricePerTon: 15.5,
        creditsHeld: 1000,
        projectDiversity: 5,
        performanceTrends: [
          { month: "Jan", value: 14000 },
          { month: "Feb", value: 15500 },
        ],
        monthlyRetirements: [
          { month: "Jan", value: 100 },
          { month: "Feb", value: 50 },
        ],
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockPerformance,
      });

      const result = await portfolioAPI.getPerformanceAnalytics();

      expect(apiClient.get).toHaveBeenCalledWith("/portfolio/performance");
      expect(result.portfolioValue).toBe(15500);
      expect(result.performanceTrends.length).toBe(2);
    });
  });

  describe("getComposition", () => {
    it("should fetch portfolio composition", async () => {
      const mockComposition = {
        methodologyDistribution: [
          { name: "VERRA", value: 600, percentage: 60 },
          { name: "GOLD_STANDARD", value: 400, percentage: 40 },
        ],
        geographicAllocation: [
          { name: "Brazil", value: 700, percentage: 70 },
          { name: "Kenya", value: 300, percentage: 30 },
        ],
        sdgImpact: [
          { name: "SDG13", value: 800, percentage: 80 },
          { name: "SDG15", value: 200, percentage: 20 },
        ],
        vintageYearDistribution: [],
        projectTypeClassification: [],
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockComposition,
      });

      const result = await portfolioAPI.getComposition();

      expect(apiClient.get).toHaveBeenCalledWith("/portfolio/composition");
      expect(result.methodologyDistribution[0].percentage).toBe(60);
    });
  });

  describe("getRiskAnalysis", () => {
    it("should fetch risk analysis", async () => {
      const mockRisk = {
        diversificationScore: 75,
        riskRating: "Low" as const,
        concentrationAnalysis: {
          topProject: { name: "Project A", percentage: 30 },
          topCountry: { name: "Brazil", percentage: 70 },
          herfindahlIndex: 0.25,
        },
        volatility: 0.12,
        projectQualityDistribution: {
          highQuality: 600,
          mediumQuality: 300,
          lowQuality: 100,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockRisk,
      });

      const result = await portfolioAPI.getRiskAnalysis();

      expect(apiClient.get).toHaveBeenCalledWith("/portfolio/risk");
      expect(result.riskRating).toBe("Low");
    });
  });

  describe("getHoldingDetails", () => {
    it("should fetch specific holding details", async () => {
      const holdingId = "holding-123";
      const mockHolding = {
        id: holdingId,
        creditId: "c1",
        companyId: "comp1",
        creditAmount: 100,
        purchasePrice: 15.5,
        purchaseDate: new Date().toISOString(),
        currentValue: 1550,
        status: "available" as const,
        credit: {
          projectName: "Test Project",
          methodology: "VERRA",
          country: "Brazil",
          vintage: 2023,
          verificationStandard: "VERRA" as const,
          sdgs: ["SDG13"],
          qualityMetrics: {
            dynamicScore: 85,
            verificationScore: 90,
            additionalityScore: 80,
            permanenceScore: 95,
            leakageScore: 88,
            cobenefitsScore: 85,
            transparencyScore: 92,
          },
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockHolding,
      });

      const result = await portfolioAPI.getHoldingDetails(holdingId);

      expect(apiClient.get).toHaveBeenCalledWith(
        `/portfolio/holdings/${holdingId}`,
      );
      expect(result.id).toBe(holdingId);
    });
  });

  describe("getTimeline", () => {
    it("should fetch timeline data with parameters", async () => {
      const mockTimeline = [
        {
          timestamp: "2024-01-01T00:00:00Z",
          growth: 1000,
          retirements: 100,
          portfolioValue: 14000,
        },
        {
          timestamp: "2024-02-01T00:00:00Z",
          growth: 1500,
          retirements: 50,
          portfolioValue: 15500,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockTimeline,
      });

      const result = await portfolioAPI.getTimeline({
        startDate: "2024-01-01",
        endDate: "2024-02-01",
        aggregation: "monthly",
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/portfolio/timeline"),
      );
      expect(result.length).toBe(2);
    });
  });

  describe("getAnalytics", () => {
    it("should fetch combined analytics data", async () => {
      const mockAnalytics = {
        summary: {
          totalRetired: 1000,
          availableBalance: 500,
          quarterlyGrowth: 15.5,
          netZeroProgress: 65,
          scope3Coverage: 45,
          sdgAlignment: 80,
          costEfficiency: 2.5,
          lastUpdatedAt: new Date().toISOString(),
        },
        performance: {
          portfolioValue: 15500,
          avgPricePerTon: 15.5,
          creditsHeld: 1000,
          projectDiversity: 5,
          performanceTrends: [],
          monthlyRetirements: [],
        },
        composition: {
          methodologyDistribution: [],
          geographicAllocation: [],
          sdgImpact: [],
          vintageYearDistribution: [],
          projectTypeClassification: [],
        },
        riskAnalysis: {
          diversificationScore: 75,
          riskRating: "Low" as const,
          concentrationAnalysis: {
            topProject: { name: "Project A", percentage: 30 },
            topCountry: { name: "Brazil", percentage: 70 },
            herfindahlIndex: 0.25,
          },
          volatility: 0.12,
          projectQualityDistribution: {
            highQuality: 600,
            mediumQuality: 300,
            lowQuality: 100,
          },
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAnalytics,
      });

      const result = await portfolioAPI.getAnalytics();

      expect(apiClient.get).toHaveBeenCalledWith("/portfolio/analytics");
      expect(result.summary).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.composition).toBeDefined();
      expect(result.riskAnalysis).toBeDefined();
    });
  });

  describe("getTransactions", () => {
    it("should fetch transaction history", async () => {
      const mockTransactions = [
        {
          id: "t1",
          type: "order" as const,
          status: "completed" as const,
          amount: 100,
          pricePerUnit: 15.5,
          totalPrice: 1550,
          creditId: "c1",
          projectName: "Project A",
          timestamp: new Date().toISOString(),
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockTransactions,
      });

      const result = await portfolioAPI.getTransactions();

      expect(apiClient.get).toHaveBeenCalledWith("/portfolio/transactions");
      expect(result.length).toBe(1);
      expect(result[0].type).toBe("order");
    });
  });
});
