import { ApiResponse, apiClient } from './api-client';
import {
  ForecastResponse,
  ImpactResponse,
  ProgressResponse,
  PurposeBreakdownResponse,
  RetirementAnalyticsQuery,
  RetirementAnalyticsSummaryResponse,
  TrendsResponse,
} from '@/types/retirement-analytics';

class RetirementAnalyticsService {
  private normalizeResponse<T>(response: ApiResponse<T> | T): ApiResponse<T> {
    if (response && typeof response === 'object' && 'success' in response) {
      return response as ApiResponse<T>;
    }

    return {
      success: true,
      data: response as T,
      timestamp: new Date().toISOString(),
    };
  }

  private buildQueryString(query: RetirementAnalyticsQuery): string {
    const params = new URLSearchParams();

    params.set('companyId', query.companyId);
    if (query.startDate) params.set('startDate', query.startDate);
    if (query.endDate) params.set('endDate', query.endDate);
    if (query.aggregation) params.set('aggregation', query.aggregation);

    return params.toString();
  }

  private withQuery(endpoint: string, query: RetirementAnalyticsQuery): string {
    const queryString = this.buildQueryString(query);
    return `${endpoint}?${queryString}`;
  }

  async getPurposeBreakdown(
    query: RetirementAnalyticsQuery,
  ): Promise<ApiResponse<PurposeBreakdownResponse>> {
    const response = await apiClient.get<PurposeBreakdownResponse>(
      this.withQuery('/retirement-analytics/purpose-breakdown', query),
    );
    return this.normalizeResponse(response);
  }

  async getTrends(
    query: RetirementAnalyticsQuery,
  ): Promise<ApiResponse<TrendsResponse>> {
    const response = await apiClient.get<TrendsResponse>(
      this.withQuery('/retirement-analytics/trends', query),
    );
    return this.normalizeResponse(response);
  }

  async getForecast(
    query: RetirementAnalyticsQuery,
  ): Promise<ApiResponse<ForecastResponse>> {
    const response = await apiClient.get<ForecastResponse>(
      this.withQuery('/retirement-analytics/forecast', query),
    );
    return this.normalizeResponse(response);
  }

  async getImpact(
    query: RetirementAnalyticsQuery,
  ): Promise<ApiResponse<ImpactResponse>> {
    const response = await apiClient.get<ImpactResponse>(
      this.withQuery('/retirement-analytics/impact', query),
    );
    return this.normalizeResponse(response);
  }

  async getProgress(
    query: RetirementAnalyticsQuery,
  ): Promise<ApiResponse<ProgressResponse>> {
    const response = await apiClient.get<ProgressResponse>(
      this.withQuery('/retirement-analytics/progress', query),
    );
    return this.normalizeResponse(response);
  }

  async getSummary(
    query: RetirementAnalyticsQuery,
  ): Promise<ApiResponse<RetirementAnalyticsSummaryResponse>> {
    const response = await apiClient.get<RetirementAnalyticsSummaryResponse>(
      this.withQuery('/retirement-analytics/summary', query),
    );
    return this.normalizeResponse(response);
  }
}

export const retirementAnalyticsService = new RetirementAnalyticsService();
export default RetirementAnalyticsService;
