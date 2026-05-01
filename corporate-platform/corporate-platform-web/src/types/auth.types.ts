export type AuthRole = 'admin' | 'manager' | 'analyst' | 'viewer' | 'auditor';

export type AuthPermission =
  | 'portfolio:view'
  | 'portfolio:export'
  | 'portfolio:analyze'
  | 'credit:view'
  | 'credit:purchase'
  | 'credit:retire'
  | 'credit:approve-retirement'
  | 'report:view'
  | 'report:generate'
  | 'report:export'
  | 'report:schedule'
  | 'team:view'
  | 'team:invite'
  | 'team:manage-roles'
  | 'team:remove'
  | 'compliance:view'
  | 'compliance:submit'
  | 'compliance:audit'
  | 'compliance:verify-retirement'
  | 'settings:view'
  | 'settings:update'
  | 'settings:billing'
  | 'admin:user-manage'
  | 'admin:view-audit-logs'
  | 'audit-hash:anchor'
  | 'audit-hash:verify';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
}

export interface RefreshResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
