/**
 * Portfolio API endpoints wrapper
 * Provides typed methods for all portfolio-related API calls
 */

import { apiClient, ApiErrorClass } from "./client";
import type {
  PortfolioSummary,
  PortfolioPerformance,
  PortfolioComposition,
  RiskAnalysis,
  PortfolioAnalytics,
  PortfolioHolding,
  PaginatedHoldings,
  Transaction,
  TimelineDataPoint,
  PaginationParams,
  TimelineQueryParams,
} from "./types";

/**
 * Portfolio API class
 * Encapsulates all portfolio-related API calls
 */
class PortfolioAPI {
  private baseEndpoint = "/portfolio";

  /**
   * Fetch portfolio summary (metrics and KPIs)
   * GET /portfolio/summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const response = await apiClient.get<PortfolioSummary>(
        `${this.baseEndpoint}/summary`,
      );

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch portfolio summary",
          400,
        );
      }

      return response.data as PortfolioSummary;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error
          ? error.message
          : "Failed to fetch portfolio summary",
        0,
        "FETCH_SUMMARY_ERROR",
      );
    }
  }

  /**
   * Fetch portfolio performance metrics and trends
   * GET /portfolio/performance
   */
  async getPerformanceAnalytics(): Promise<PortfolioPerformance> {
    try {
      const response = await apiClient.get<PortfolioPerformance>(
        `${this.baseEndpoint}/performance`,
      );

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch performance analytics",
          400,
        );
      }

      return response.data as PortfolioPerformance;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error
          ? error.message
          : "Failed to fetch performance analytics",
        0,
        "FETCH_PERFORMANCE_ERROR",
      );
    }
  }

  /**
   * Fetch portfolio composition (distribution breakdown)
   * GET /portfolio/composition
   */
  async getComposition(): Promise<PortfolioComposition> {
    try {
      const response = await apiClient.get<PortfolioComposition>(
        `${this.baseEndpoint}/composition`,
      );

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch portfolio composition",
          400,
        );
      }

      return response.data as PortfolioComposition;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error
          ? error.message
          : "Failed to fetch portfolio composition",
        0,
        "FETCH_COMPOSITION_ERROR",
      );
    }
  }

  /**
   * Fetch portfolio risk analysis
   * GET /portfolio/risk
   */
  async getRiskAnalysis(): Promise<RiskAnalysis> {
    try {
      const response = await apiClient.get<RiskAnalysis>(
        `${this.baseEndpoint}/risk`,
      );

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch risk analysis",
          400,
        );
      }

      return response.data as RiskAnalysis;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error
          ? error.message
          : "Failed to fetch risk analysis",
        0,
        "FETCH_RISK_ERROR",
      );
    }
  }

  /**
   * Fetch portfolio holdings (paginated)
   * GET /portfolio/holdings?page=1&pageSize=10
   */
  async getHoldings(params?: PaginationParams): Promise<PaginatedHoldings> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page !== undefined) {
        queryParams.append("page", params.page.toString());
      }
      if (params?.pageSize !== undefined) {
        queryParams.append("pageSize", params.pageSize.toString());
      }

      const endpoint = queryParams.toString()
        ? `${this.baseEndpoint}/holdings?${queryParams.toString()}`
        : `${this.baseEndpoint}/holdings`;

      const response = await apiClient.get<PaginatedHoldings>(endpoint);

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch holdings",
          400,
        );
      }

      return response.data as PaginatedHoldings;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error ? error.message : "Failed to fetch holdings",
        0,
        "FETCH_HOLDINGS_ERROR",
      );
    }
  }

  /**
   * Fetch specific holding details
   * GET /portfolio/holdings/:id
   */
  async getHoldingDetails(holdingId: string): Promise<PortfolioHolding> {
    try {
      if (!holdingId || holdingId.trim() === "") {
        throw new ApiErrorClass(
          "Holding ID is required",
          400,
          "INVALID_HOLDING_ID",
        );
      }

      const response = await apiClient.get<PortfolioHolding>(
        `${this.baseEndpoint}/holdings/${holdingId}`,
      );

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch holding details",
          400,
        );
      }

      return response.data as PortfolioHolding;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error
          ? error.message
          : "Failed to fetch holding details",
        0,
        "FETCH_HOLDING_DETAILS_ERROR",
      );
    }
  }

  /**
   * Fetch portfolio timeline data (historical performance)
   * GET /portfolio/timeline?startDate=...&endDate=...&aggregation=monthly
   */
  async getTimeline(
    params?: TimelineQueryParams,
  ): Promise<TimelineDataPoint[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.startDate) {
        queryParams.append("startDate", params.startDate);
      }
      if (params?.endDate) {
        queryParams.append("endDate", params.endDate);
      }
      if (params?.aggregation) {
        queryParams.append("aggregation", params.aggregation);
      }

      const endpoint = queryParams.toString()
        ? `${this.baseEndpoint}/timeline?${queryParams.toString()}`
        : `${this.baseEndpoint}/timeline`;

      const response = await apiClient.get<TimelineDataPoint[]>(endpoint);

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch timeline data",
          400,
        );
      }

      return response.data as TimelineDataPoint[];
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error
          ? error.message
          : "Failed to fetch timeline data",
        0,
        "FETCH_TIMELINE_ERROR",
      );
    }
  }

  /**
   * Fetch combined analytics dashboard data
   * GET /portfolio/analytics
   * This endpoint combines summary, performance, composition, and risk in a single call
   */
  async getAnalytics(): Promise<PortfolioAnalytics> {
    try {
      const response = await apiClient.get<PortfolioAnalytics>(
        `${this.baseEndpoint}/analytics`,
      );

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch analytics",
          400,
        );
      }

      return response.data as PortfolioAnalytics;
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error ? error.message : "Failed to fetch analytics",
        0,
        "FETCH_ANALYTICS_ERROR",
      );
    }
  }

  /**
   * Fetch transaction history for portfolio
   * Note: Backend may need to expose this endpoint separately
   * For now, we can derive from holdings data
   */
  async getTransactions(params?: PaginationParams): Promise<Transaction[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.page !== undefined) {
        queryParams.append("page", params.page.toString());
      }
      if (params?.pageSize !== undefined) {
        queryParams.append("pageSize", params.pageSize.toString());
      }

      const endpoint = queryParams.toString()
        ? `${this.baseEndpoint}/transactions?${queryParams.toString()}`
        : `${this.baseEndpoint}/transactions`;

      const response = await apiClient.get<Transaction[]>(endpoint);

      if (!response.success) {
        throw new ApiErrorClass(
          response.error || "Failed to fetch transactions",
          400,
        );
      }

      return response.data as Transaction[];
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      throw new ApiErrorClass(
        error instanceof Error ? error.message : "Failed to fetch transactions",
        0,
        "FETCH_TRANSACTIONS_ERROR",
      );
    }
  }
}

// Create singleton instance
export const portfolioAPI = new PortfolioAPI();

export default portfolioAPI;
