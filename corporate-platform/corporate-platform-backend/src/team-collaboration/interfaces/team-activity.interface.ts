export interface TeamActivityItem {
  id: string;
  companyId: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  activityType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}

export interface PaginatedTeamActivity {
  items: TeamActivityItem[];
  nextCursor?: string;
}

