// Types used by the Team Collaboration API client.
// These mirror the backend response contracts under `/api/v1/team/*`.

export type ActivityType =
  | 'ACTIVITY_CREATED'
  | 'ACTIVITY_UPDATED'
  | 'COMMENT_ADDED'
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'MESSAGE_POSTED'
  | 'TASK_COMPLETED'
  | string;

export interface TeamActivity {
  id: string;
  companyId: string;
  userId: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityFeedQuery {
  limit?: number;
  offset?: number;
  type?: ActivityType;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ActivitySummary {
  total: number;
  byType: Record<string, number>;
  periodStart: string;
  periodEnd: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  joinedAt: string;
}

export interface TeamPerformance {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  score: number;
  members?: TeamMember[];
  trends?: Array<{ date: string; value: number }>;
  benchmarks?: Record<string, number>;
}

export interface CollaborationScoreComponents {
  communication: number;
  responsiveness: number;
  participation: number;
  outcomes: number;
}

export interface CollaborationScore {
  companyId: string;
  periodStart?: string;
  periodEnd?: string;
  overallScore: number;
  components: CollaborationScoreComponents;
  rating: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCELLENT';
  history?: Array<{ date: string; score: number }>;
  recommendations?: string[];
}

export interface TeamNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface TeamMessage {
  id: string;
  teamId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class TeamCollaborationApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'TeamCollaborationApiError';
    this.status = status;
    this.body = body;
  }
}
