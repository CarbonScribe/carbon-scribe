/**
 * Permission identifiers for RBAC.
 * Format: category:action (e.g. portfolio:view, credit:purchase).
 */

/** Portfolio: view, export, analyze */
export const PORTFOLIO_VIEW = 'portfolio:view';
export const PORTFOLIO_EXPORT = 'portfolio:export';
export const PORTFOLIO_ANALYZE = 'portfolio:analyze';

/** Credit: view, purchase, retire, approve retirement */
export const CREDIT_VIEW = 'credit:view';
export const CREDIT_PURCHASE = 'credit:purchase';
export const CREDIT_RETIRE = 'credit:retire';
export const CREDIT_APPROVE_RETIREMENT = 'credit:approve-retirement';

/** Report: view, generate, export, schedule */
export const REPORT_VIEW = 'report:view';
export const REPORT_GENERATE = 'report:generate';
export const REPORT_EXPORT = 'report:export';
export const REPORT_SCHEDULE = 'report:schedule';

/** Team: view, invite, manage roles, remove */
export const TEAM_VIEW = 'team:view';
export const TEAM_INVITE = 'team:invite';
export const TEAM_MANAGE_ROLES = 'team:manage-roles';
export const TEAM_REMOVE = 'team:remove';

/** Compliance: view, submit, audit */
export const COMPLIANCE_VIEW = 'compliance:view';
export const COMPLIANCE_SUBMIT = 'compliance:submit';
export const COMPLIANCE_AUDIT = 'compliance:audit';

/** Settings: view, update, billing */
export const SETTINGS_VIEW = 'settings:view';
export const SETTINGS_UPDATE = 'settings:update';
export const SETTINGS_BILLING = 'settings:billing';

/** Admin: user management, audit logs */
export const ADMIN_USER_MANAGE = 'admin:user-manage';
export const ADMIN_VIEW_AUDIT_LOGS = 'admin:view-audit-logs';

/** All permissions (flat list) */
export const ALL_PERMISSIONS = [
  PORTFOLIO_VIEW,
  PORTFOLIO_EXPORT,
  PORTFOLIO_ANALYZE,
  CREDIT_VIEW,
  CREDIT_PURCHASE,
  CREDIT_RETIRE,
  CREDIT_APPROVE_RETIREMENT,
  REPORT_VIEW,
  REPORT_GENERATE,
  REPORT_EXPORT,
  REPORT_SCHEDULE,
  TEAM_VIEW,
  TEAM_INVITE,
  TEAM_MANAGE_ROLES,
  TEAM_REMOVE,
  COMPLIANCE_VIEW,
  COMPLIANCE_SUBMIT,
  COMPLIANCE_AUDIT,
  SETTINGS_VIEW,
  SETTINGS_UPDATE,
  SETTINGS_BILLING,
  ADMIN_USER_MANAGE,
  ADMIN_VIEW_AUDIT_LOGS,
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Role identifiers (must match User.role and JWT payload) */
export const ROLES = [
  'admin',
  'analyst',
  'manager',
  'viewer',
  'auditor',
] as const;

export type Role = (typeof ROLES)[number];

/** Role-to-permissions mapping. Admin has all permissions. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  analyst: [
    PORTFOLIO_VIEW,
    PORTFOLIO_EXPORT,
    PORTFOLIO_ANALYZE,
    CREDIT_VIEW,
    REPORT_VIEW,
    REPORT_GENERATE,
    REPORT_EXPORT,
    COMPLIANCE_VIEW,
    TEAM_VIEW,
  ],
  manager: [
    PORTFOLIO_VIEW,
    PORTFOLIO_EXPORT,
    CREDIT_VIEW,
    CREDIT_PURCHASE,
    CREDIT_RETIRE,
    CREDIT_APPROVE_RETIREMENT,
    REPORT_VIEW,
    REPORT_GENERATE,
    COMPLIANCE_VIEW,
    COMPLIANCE_SUBMIT,
    TEAM_VIEW,
  ],
  viewer: [
    PORTFOLIO_VIEW,
    CREDIT_VIEW,
    REPORT_VIEW,
    COMPLIANCE_VIEW,
    TEAM_VIEW,
  ],
  auditor: [
    PORTFOLIO_VIEW,
    PORTFOLIO_EXPORT,
    REPORT_VIEW,
    REPORT_EXPORT,
    COMPLIANCE_VIEW,
    COMPLIANCE_AUDIT,
    ADMIN_VIEW_AUDIT_LOGS,
  ],
};
