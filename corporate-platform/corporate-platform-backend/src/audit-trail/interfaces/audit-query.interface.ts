export interface AuditQuery {
  companyId: string;
  userId?: string;
  eventType?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult<T> {
  events: T[];
  total: number;
  page: number;
  limit: number;
}
