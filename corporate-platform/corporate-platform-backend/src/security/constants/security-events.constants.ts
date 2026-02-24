export enum SecurityEvents {
  AuditLog = 'audit-log',
  IpBlocked = 'ip-blocked',
  AuthLoginFailed = 'auth-login-failed',
}

export type SecuritySeverity = 'info' | 'warn' | 'error' | 'critical';

export const EventSeverityMap: Record<SecurityEvents, SecuritySeverity> = {
  [SecurityEvents.AuditLog]: 'info',
  [SecurityEvents.IpBlocked]: 'warn',
  [SecurityEvents.AuthLoginFailed]: 'warn',
};

