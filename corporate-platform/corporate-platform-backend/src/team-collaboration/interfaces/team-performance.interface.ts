export interface TeamPerformanceDashboard {
  periodStart: Date;
  periodEnd: Date;
  totalActions: number;
  activeMembers: number;
  actionsPerDay: number;
  topActivityTypes: { activityType: string; count: number }[];
}

export interface MemberPerformanceSummary {
  userId: string;
  actionsCount: number;
  uniqueDays: number;
  contributions: Record<string, number>;
  collaborationScore: number;
}

export interface PerformanceTrendPoint {
  bucketStart: Date;
  actionsCount: number;
  activeMembers: number;
}

