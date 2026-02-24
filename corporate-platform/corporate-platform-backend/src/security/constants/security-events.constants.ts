export const SecurityEvents = {
  AuthLoginSuccess: 'auth.login.success',
  AuthLoginFailed: 'auth.login.failed',
  AuthLogout: 'auth.logout',
  AuthPasswordChange: 'auth.password.change',
  AuthPasswordReset: 'auth.password.reset',
  AuthPermissionDenied: 'auth.permission.denied',
  AuthRoleChanged: 'auth.role.changed',
  AuthCrossTenantAttempt: 'auth.cross-tenant.attempt',
  ApiKeyCreated: 'apikey.created',
  ApiKeyRevoked: 'apikey.revoked',
  ApiKeyRotated: 'apikey.rotated',
  ApiKeyRateLimitExceeded: 'apikey.rate-limit.exceeded',
  IpBlocked: 'ip.blocked',
  IpWhitelistAdded: 'ip.whitelist.added',
  IpWhitelistRemoved: 'ip.whitelist.removed',
  UserCreated: 'user.created',
  UserUpdated: 'user.updated',
  UserDeleted: 'user.deleted',
  UserRoleChanged: 'user.role.changed',
  CreditRetired: 'credit.retired',
  ReportExported: 'report.exported',
  SettingsChanged: 'settings.changed',
  RateLimitExceeded: 'rate-limit.exceeded',
  SuspiciousPatternDetected: 'suspicious.pattern.detected',
} as const;

export type SecurityEventType =
  (typeof SecurityEvents)[keyof typeof SecurityEvents];

export const SecuritySeverity = {
  Info: 'info',
  Warning: 'warning',
  Critical: 'critical',
} as const;

export type SecuritySeverityLevel =
  (typeof SecuritySeverity)[keyof typeof SecuritySeverity];

export const EventSeverityMap: Record<
  SecurityEventType,
  SecuritySeverityLevel
> = {
  [SecurityEvents.AuthLoginSuccess]: SecuritySeverity.Info,
  [SecurityEvents.AuthLoginFailed]: SecuritySeverity.Critical,
  [SecurityEvents.AuthLogout]: SecuritySeverity.Info,
  [SecurityEvents.AuthPasswordChange]: SecuritySeverity.Info,
  [SecurityEvents.AuthPasswordReset]: SecuritySeverity.Info,
  [SecurityEvents.AuthPermissionDenied]: SecuritySeverity.Warning,
  [SecurityEvents.AuthRoleChanged]: SecuritySeverity.Warning,
  [SecurityEvents.AuthCrossTenantAttempt]: SecuritySeverity.Warning,
  [SecurityEvents.ApiKeyCreated]: SecuritySeverity.Info,
  [SecurityEvents.ApiKeyRevoked]: SecuritySeverity.Info,
  [SecurityEvents.ApiKeyRotated]: SecuritySeverity.Info,
  [SecurityEvents.ApiKeyRateLimitExceeded]: SecuritySeverity.Info,
  [SecurityEvents.IpBlocked]: SecuritySeverity.Warning,
  [SecurityEvents.IpWhitelistAdded]: SecuritySeverity.Warning,
  [SecurityEvents.IpWhitelistRemoved]: SecuritySeverity.Warning,
  [SecurityEvents.UserCreated]: SecuritySeverity.Info,
  [SecurityEvents.UserUpdated]: SecuritySeverity.Info,
  [SecurityEvents.UserDeleted]: SecuritySeverity.Info,
  [SecurityEvents.UserRoleChanged]: SecuritySeverity.Info,
  [SecurityEvents.CreditRetired]: SecuritySeverity.Info,
  [SecurityEvents.ReportExported]: SecuritySeverity.Info,
  [SecurityEvents.SettingsChanged]: SecuritySeverity.Info,
  [SecurityEvents.RateLimitExceeded]: SecuritySeverity.Critical,
  [SecurityEvents.SuspiciousPatternDetected]: SecuritySeverity.Critical,
};
