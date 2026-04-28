export interface TeamActivity {
  id: string;
  companyId: string;
  userId: string;
  activityType: ActivityType;
  entityType?: string;
  entityId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export const ACTIVITY_TYPE_ENUM = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  RETIREMENT_CREATED: 'RETIREMENT_CREATED',
  REPORT_GENERATED: 'REPORT_GENERATED',
  TARGET_SET: 'TARGET_SET',
  PORTFOLIO_UPDATED: 'PORTFOLIO_UPDATED',
  TEAM_MEMBER_ADDED: 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED: 'TEAM_MEMBER_REMOVED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  COMPLIANCE_COMPLETED: 'COMPLIANCE_COMPLETED',
  AUCTION_BID_PLACED: 'AUCTION_BID_PLACED',
  CREDIT_PURCHASED: 'CREDIT_PURCHASED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  API_KEY_CREATED: 'API_KEY_CREATED',
  WEBHOOK_CONFIGURED: 'WEBHOOK_CONFIGURED',
} as const;

export type ActivityType =
  (typeof ACTIVITY_TYPE_ENUM)[keyof typeof ACTIVITY_TYPE_ENUM];

export interface ActivityFeedQuery {
  companyId: string;
  userId?: string;
  activityTypes?: ActivityType[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  entityTypes?: string[];
}

export interface ActivitySummary {
  activityType: ActivityType;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RealTimeActivity {
  event: string;
  data: TeamActivity;
  timestamp: number;
}
