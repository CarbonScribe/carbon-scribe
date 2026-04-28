export enum AuditEventType {
  RETIREMENT = 'RETIREMENT',
  COMPLIANCE_REPORT = 'COMPLIANCE_REPORT',
  TARGET_UPDATE = 'TARGET_UPDATE',
  FRAMEWORK_REGISTRATION = 'FRAMEWORK_REGISTRATION',
  GHG_CALCULATION = 'GHG_CALCULATION',
  SBTI_VALIDATION = 'SBTI_VALIDATION',
  CSRD_DISCLOSURE = 'CSRD_DISCLOSURE',
  CORSIA_SUBMISSION = 'CORSIA_SUBMISSION',
  CBAM_REPORT = 'CBAM_REPORT',
  USER_ACTION = 'USER_ACTION',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  VALIDATE = 'VALIDATE',
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export interface AuditEvent {
  id: string;
  companyId: string;
  userId: string;
  eventType: AuditEventType | string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  previousState?: unknown;
  newState?: unknown;
  metadata?: AuditMetadata;
  hash: string;
  previousHash: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: string;
  createdAt: string;
}

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface AuditEventResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditEventDetail {
  event: AuditEvent;
}

export interface VerificationResult {
  eventId: string;
  isValid: boolean;
  hashMatch: boolean;
  chainValid: boolean;
  message: string;
  hash: string;
  previousHash: string;
  recomputedHash: string;
  transactionHash?: string;
  blockNumber?: number;
}

export interface BatchVerificationResult {
  results: VerificationResult[];
  totalValid: number;
  totalInvalid: number;
  overallValid: boolean;
}

export interface ChainIntegrityResult {
  isValid: boolean;
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  brokenChains: Array<{
    eventId: string;
    expectedHash: string;
    actualHash: string;
  }>;
  message: string;
  checkedAt: string;
}

export interface AuditQueryParams {
  userId?: string;
  eventType?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  format?: 'csv' | 'json';
}

export interface CreateAuditEventInput {
  eventType: AuditEventType | string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  previousState?: unknown;
  newState?: unknown;
  metadata?: Record<string, unknown>;
}
