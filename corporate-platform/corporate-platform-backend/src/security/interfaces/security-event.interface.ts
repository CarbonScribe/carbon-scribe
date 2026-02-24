import {
  SecurityEvents,
  SecuritySeverity,
} from '../constants/security-events.constants';

export interface SecurityEventInput {
  eventType: SecurityEvents;
  severity?: SecuritySeverity;
  companyId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  method?: string;
  status?: string;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

