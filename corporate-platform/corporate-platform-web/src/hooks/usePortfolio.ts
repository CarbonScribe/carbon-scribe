/**
 * Hook for managing portfolio data
 * Handles fetching, caching, and state management
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { portfolioAPI } from "@/api/portfolio";
import { logger } from "@/lib/logger";
import { getUserFriendlyMessage, AppError } from "@/lib/errors";
import { toast } from "@/hooks/useToast";
import type {
  PortfolioSummary,
  PortfolioPerformance,
  PortfolioComposition,
  RiskAnalysis,
  PortfolioAnalytics,
  PaginatedHoldings,
  PortfolioHolding,
  TimelineDataPoint,
  Transaction,
  PaginationParams,
  TimelineQueryParams,
} from "@/api/types";

export interface PortfolioState {
  summary: PortfolioSummary | null;
  performance: PortfolioPerformance | null;
  composition: PortfolioComposition | null;
  riskAnalysis: RiskAnalysis | null;
  holdings: PaginatedHoldings | null;
  analytics: PortfolioAnalytics | null;
  timeline: TimelineDataPoint[] | null;
  transactions: Transaction[] | null;
  selectedHolding: PortfolioHolding | null;
  // Legacy properties for backward compatibility
  totalSpent: number | null;
  totalRetired: number | null;
  currentBalance: number | null;
  sdgContributions: Record<string, number> | null;
}

export interface PortfolioErrors {
  summary: AppError | null;
  performance: AppError | null;
  composition: AppError | null;
  riskAnalysis: AppError | null;
  holdings: AppError | null;
  analytics: AppError | null;
  timeline: AppError | null;
  transactions: AppError | null;
  selectedHolding: AppError | null;
}

export interface PortfolioLoading {
  summary: boolean;
  performance: boolean;
  composition: boolean;
  riskAnalysis: boolean;
  holdings: boolean;
  analytics: boolean;
  timeline: boolean;
  transactions: boolean;
  selectedHolding: boolean;
}

const initialState: PortfolioState = {
  summary: null,
  performance: null,
  composition: null,
  riskAnalysis: null,
  holdings: null,
  analytics: null,
  timeline: null,
  transactions: null,
  selectedHolding: null,
  // Legacy properties for backward compatibility
  totalSpent: null,
  totalRetired: null,
  currentBalance: null,
  sdgContributions: null,
};

const initialErrors: PortfolioErrors = {
  summary: null,
  performance: null,
  composition: null,
  riskAnalysis: null,
  holdings: null,
  analytics: null,
  timeline: null,
  transactions: null,
  selectedHolding: null,
};

const initialLoading: PortfolioLoading = {
  summary: false,
  performance: false,
  composition: false,
  riskAnalysis: false,
  holdings: false,
  analytics: false,
  timeline: false,
  transactions: false,
  selectedHolding: false,
};

/**
 * Hook to manage portfolio data fetching and state
 */
export function usePortfolio() {
  const [data, setData] = useState<PortfolioState>(initialState);
  const [errors, setErrors] = useState<PortfolioErrors>(initialErrors);
  const [loading, setLoading] = useState<PortfolioLoading>(initialLoading);

  // Fetch portfolio summary
  const fetchSummary = useCallback(async () => {
    setLoading((prev) => ({ ...prev, summary: true }));
    setErrors((prev) => ({ ...prev, summary: null }));

    try {
      logger.setContext("usePortfolio.fetchSummary");
      const summary = await portfolioAPI.getPortfolioSummary();
      setData((prev) => ({ ...prev, summary }));
      logger.info("Portfolio summary fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, summary: appError }));
      logger.error("Failed to fetch portfolio summary", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, summary: false }));
    }
  }, []);

  // Fetch portfolio performance
  const fetchPerformance = useCallback(async () => {
    setLoading((prev) => ({ ...prev, performance: true }));
    setErrors((prev) => ({ ...prev, performance: null }));

    try {
      logger.setContext("usePortfolio.fetchPerformance");
      const performance = await portfolioAPI.getPerformanceAnalytics();
      setData((prev) => ({ ...prev, performance }));
      logger.info("Portfolio performance fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, performance: appError }));
      logger.error("Failed to fetch portfolio performance", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, performance: false }));
    }
  }, []);

  // Fetch portfolio composition
  const fetchComposition = useCallback(async () => {
    setLoading((prev) => ({ ...prev, composition: true }));
    setErrors((prev) => ({ ...prev, composition: null }));

    try {
      logger.setContext("usePortfolio.fetchComposition");
      const composition = await portfolioAPI.getComposition();
      setData((prev) => ({ ...prev, composition }));
      logger.info("Portfolio composition fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, composition: appError }));
      logger.error("Failed to fetch portfolio composition", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, composition: false }));
    }
  }, []);

  // Fetch risk analysis
  const fetchRiskAnalysis = useCallback(async () => {
    setLoading((prev) => ({ ...prev, riskAnalysis: true }));
    setErrors((prev) => ({ ...prev, riskAnalysis: null }));

    try {
      logger.setContext("usePortfolio.fetchRiskAnalysis");
      const riskAnalysis = await portfolioAPI.getRiskAnalysis();
      setData((prev) => ({ ...prev, riskAnalysis }));
      logger.info("Risk analysis fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, riskAnalysis: appError }));
      logger.error("Failed to fetch risk analysis", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, riskAnalysis: false }));
    }
  }, []);

  // Fetch portfolio holdings
  const fetchHoldings = useCallback(async (params?: PaginationParams) => {
    setLoading((prev) => ({ ...prev, holdings: true }));
    setErrors((prev) => ({ ...prev, holdings: null }));

    try {
      logger.setContext("usePortfolio.fetchHoldings");
      const holdings = await portfolioAPI.getHoldings(params);
      setData((prev) => ({ ...prev, holdings }));
      logger.info("Portfolio holdings fetched successfully", {
        page: params?.page,
      });
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, holdings: appError }));
      logger.error("Failed to fetch portfolio holdings", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, holdings: false }));
    }
  }, []);

  // Fetch analytics (combined)
  const fetchAnalytics = useCallback(async () => {
    setLoading((prev) => ({ ...prev, analytics: true }));
    setErrors((prev) => ({ ...prev, analytics: null }));

    try {
      logger.setContext("usePortfolio.fetchAnalytics");
      const analytics = await portfolioAPI.getAnalytics();
      setData((prev) => ({ ...prev, analytics }));
      logger.info("Portfolio analytics fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, analytics: appError }));
      logger.error("Failed to fetch portfolio analytics", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, analytics: false }));
    }
  }, []);

  // Fetch timeline data
  const fetchTimeline = useCallback(async (params?: TimelineQueryParams) => {
    setLoading((prev) => ({ ...prev, timeline: true }));
    setErrors((prev) => ({ ...prev, timeline: null }));

    try {
      logger.setContext("usePortfolio.fetchTimeline");
      const timeline = await portfolioAPI.getTimeline(params);
      setData((prev) => ({ ...prev, timeline }));
      logger.info("Portfolio timeline fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, timeline: appError }));
      logger.error("Failed to fetch portfolio timeline", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, timeline: false }));
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async (params?: PaginationParams) => {
    setLoading((prev) => ({ ...prev, transactions: true }));
    setErrors((prev) => ({ ...prev, transactions: null }));

    try {
      logger.setContext("usePortfolio.fetchTransactions");
      const transactions = await portfolioAPI.getTransactions(params);
      setData((prev) => ({ ...prev, transactions }));
      logger.info("Transactions fetched successfully");
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, transactions: appError }));
      logger.error("Failed to fetch transactions", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, transactions: false }));
    }
  }, []);

  // Fetch holding details
  const fetchHoldingDetails = useCallback(async (holdingId: string) => {
    setLoading((prev) => ({ ...prev, selectedHolding: true }));
    setErrors((prev) => ({ ...prev, selectedHolding: null }));

    try {
      logger.setContext("usePortfolio.fetchHoldingDetails");
      const holding = await portfolioAPI.getHoldingDetails(holdingId);
      setData((prev) => ({ ...prev, selectedHolding: holding }));
      logger.info("Holding details fetched successfully", { holdingId });
    } catch (error) {
      const appError = error as AppError;
      setErrors((prev) => ({ ...prev, selectedHolding: appError }));
      logger.error("Failed to fetch holding details", appError);
      toast.error(getUserFriendlyMessage(appError));
    } finally {
      setLoading((prev) => ({ ...prev, selectedHolding: false }));
    }
  }, []);

  // Select a holding directly (client-side)
  const selectHolding = useCallback((holding: PortfolioHolding) => {
    setData((prev) => ({ ...prev, selectedHolding: holding }));
  }, []);

  // Clear selected holding
  const clearHolding = useCallback(() => {
    setData((prev) => ({ ...prev, selectedHolding: null }));
  }, []);

  // Fetch all portfolio data in parallel
  const fetchAll = useCallback(async () => {
    logger.setContext("usePortfolio.fetchAll");
    logger.info("Fetching all portfolio data");

    await Promise.allSettled([
      fetchSummary(),
      fetchPerformance(),
      fetchComposition(),
      fetchRiskAnalysis(),
      fetchHoldings(),
    ]);
  }, [
    fetchSummary,
    fetchPerformance,
    fetchComposition,
    fetchRiskAnalysis,
    fetchHoldings,
  ]);

  // Reset state
  const reset = useCallback(() => {
    setData(initialState);
    setErrors(initialErrors);
    setLoading(initialLoading);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    // Data
    data,
    summary: data.summary,
    performance: data.performance,
    composition: data.composition,
    riskAnalysis: data.riskAnalysis,
    holdings: data.holdings,
    analytics: data.analytics,
    timeline: data.timeline,
    transactions: data.transactions,
    selectedHolding: data.selectedHolding,

    // Errors
    errors,
    summaryError: errors.summary,
    performanceError: errors.performance,
    compositionError: errors.composition,
    riskAnalysisError: errors.riskAnalysis,
    holdingsError: errors.holdings,
    analyticsError: errors.analytics,
    timelineError: errors.timeline,
    transactionsError: errors.transactions,
    selectedHoldingError: errors.selectedHolding,

    // Loading
    loading,
    isLoadingSummary: loading.summary,
    isLoadingPerformance: loading.performance,
    isLoadingComposition: loading.composition,
    isLoadingRiskAnalysis: loading.riskAnalysis,
    isLoadingHoldings: loading.holdings,
    isLoadingAnalytics: loading.analytics,
    isLoadingTimeline: loading.timeline,
    isLoadingTransactions: loading.transactions,
    isLoadingSelectedHolding: loading.selectedHolding,
    isLoading: Object.values(loading).some((v) => v),

    // Methods
    fetchSummary,
    fetchPerformance,
    fetchComposition,
    fetchRiskAnalysis,
    fetchHoldings,
    fetchAnalytics,
    fetchTimeline,
    fetchTransactions,
    fetchHoldingDetails,
    selectHolding,
    clearHolding,
    fetchAll,
    reset,
  };
}

export default usePortfolio;

// Re-export types for convenience
export type { PortfolioHolding } from "@/api/types";
