import {
  SecurityEventType,
  SecuritySeverityLevel,
} from '../constants/security-events.constants';

export interface SecurityEventDetails {
  [key: string]: any;
}

export interface SecurityEventInput {
  eventType: SecurityEventType;
  severity?: SecuritySeverityLevel;
  companyId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resource?: string | null;
  method?: string | null;
  details?: SecurityEventDetails | null;
  oldValue?: SecurityEventDetails | null;
  newValue?: SecurityEventDetails | null;
  status: string;
  statusCode?: number | null;
  timestamp?: Date;
}
