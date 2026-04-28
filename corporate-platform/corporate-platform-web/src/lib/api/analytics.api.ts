import { authApiClient } from '@/lib/api/auth-http';
import type {
  DashboardOverview,
  DashboardInsights,
  RetirementForecast,
  ImpactForecast,
  TrendDetection,
  QualityRadarData,
  PortfolioQualityScore,
  IndustryBenchmark,
  PerformanceTimeSeries,
  MetricBreakdown,
  PerformanceRanking,
  ProjectComparison,
  SimilarProject,
  ProjectOutlier,
} from '@/types/analytics.types';

const ANALYTICS_PREFIX = '/api/v1/analytics';

// ========================
// Dashboard Analytics
// ========================

export async function getDashboardOverview(period: string = 'MONTHLY'): Promise<DashboardOverview> {
  return authApiClient.get<DashboardOverview>(
    `${ANALYTICS_PREFIX}/dashboard/overview?period=${period}`
  );
}

export async function getDashboardInsights(): Promise<DashboardInsights> {
  return authApiClient.get<DashboardInsights>(`${ANALYTICS_PREFIX}/dashboard/insights`);
}

// ========================
// Predictive Analytics
// ========================

export async function predictRetirements(months: number = 12): Promise<RetirementForecast> {
  return authApiClient.get<RetirementForecast>(
    `${ANALYTICS_PREFIX}/predictive/retirements?months=${months}`
  );
}

export async function predictImpact(months: number = 12): Promise<ImpactForecast> {
  return authApiClient.get<ImpactForecast>(
    `${ANALYTICS_PREFIX}/predictive/impact?months=${months}`
  );
}

export async function detectTrends(): Promise<TrendDetection[]> {
  return authApiClient.get<TrendDetection[]>(`${ANALYTICS_PREFIX}/predictive/trends`);
}

// ========================
// Quality Analytics
// ========================

export async function getQualityRadar(projectId: string): Promise<QualityRadarData> {
  return authApiClient.get<QualityRadarData>(
    `${ANALYTICS_PREFIX}/quality/radar/${projectId}`
  );
}

export async function getPortfolioQuality(): Promise<PortfolioQualityScore> {
  return authApiClient.get<PortfolioQualityScore>(`${ANALYTICS_PREFIX}/quality/portfolio`);
}

export async function getQualityBenchmarks(
  industry?: string,
  region?: string
): Promise<IndustryBenchmark[]> {
  const params = new URLSearchParams();
  if (industry) params.set('industry', industry);
  if (region) params.set('region', region);
  
  const queryString = params.toString();
  const path = queryString
    ? `${ANALYTICS_PREFIX}/quality/benchmarks?${queryString}`
    : `${ANALYTICS_PREFIX}/quality/benchmarks`;
    
  return authApiClient.get<IndustryBenchmark[]>(path);
}

// ========================
// Performance Analytics
// ========================

export async function getPerformanceOverTime(
  startDate: string,
  endDate: string
): Promise<PerformanceTimeSeries> {
  return authApiClient.get<PerformanceTimeSeries>(
    `${ANALYTICS_PREFIX}/performance/over-time?startDate=${startDate}&endDate=${endDate}`
  );
}

export async function getPerformanceByMetric(
  metric: string = 'retirement_volume',
  dimension: string = 'projectType'
): Promise<MetricBreakdown> {
  return authApiClient.get<MetricBreakdown>(
    `${ANALYTICS_PREFIX}/performance/by-metric?metric=${metric}&dimension=${dimension}`
  );
}

export async function getPerformanceRankings(
  metric: string = 'quality',
  period: string = 'MONTHLY'
): Promise<PerformanceRanking> {
  return authApiClient.get<PerformanceRanking>(
    `${ANALYTICS_PREFIX}/performance/rankings?metric=${metric}&period=${period}`
  );
}

// ========================
// Project Comparison
// ========================

export async function compareProjects(projectIds: string[]): Promise<ProjectComparison> {
  return authApiClient.get<ProjectComparison>(
    `${ANALYTICS_PREFIX}/projects/compare?projectIds=${projectIds.join(',')}`
  );
}

export async function getSimilarProjects(
  projectId: string,
  limit: number = 5
): Promise<SimilarProject[]> {
  return authApiClient.get<SimilarProject[]>(
    `${ANALYTICS_PREFIX}/projects/similar/${projectId}?limit=${limit}`
  );
}

export async function getProjectOutliers(
  metric: string = 'quality'
): Promise<ProjectOutlier[]> {
  return authApiClient.get<ProjectOutlier[]>(
    `${ANALYTICS_PREFIX}/projects/outliers?metric=${metric}`
  );
}
