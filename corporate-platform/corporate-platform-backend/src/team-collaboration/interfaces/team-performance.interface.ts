export interface TeamPerformance {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: PerformanceMetrics;
  memberMetrics: MemberPerformance[];
  trends: PerformanceTrends;
  benchmarks: PerformanceBenchmarks;
}

export interface PerformanceMetrics {
  totalActions: number;
  actionsPerMember: number;
  activeDays: number;
  completionRate: number;
  avgResponseTime: number;
  goalProgress: number;
  engagementScore: number;
}

export interface MemberPerformance {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  actionsCount: number;
  uniqueDays: number;
  completionRate: number;
  avgResponseTime: number;
  topActivityType: string;
  rank: number;
}

export interface PerformanceTrends {
  actionsTrend: TrendData[];
  engagementTrend: TrendData[];
  completionTrend: TrendData[];
}

export interface TrendData {
  period: string;
  value: number;
  date: Date;
}

export interface PerformanceBenchmarks {
  industryAverage: number;
  teamAverage: number;
  topPerformerThreshold: number;
  needsImprovementThreshold: number;
}

export interface PerformanceQuery {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  includeMembers?: boolean;
  includeTrends?: boolean;
  includeBenchmarks?: boolean;
}
