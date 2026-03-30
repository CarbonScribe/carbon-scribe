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

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface CreateAuditEventInput {
  companyId: string;
  userId: string;
  eventType: AuditEventType | string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  previousState?: unknown;
  newState?: unknown;
  metadata?: AuditMetadata;
  timestamp?: Date;
}
