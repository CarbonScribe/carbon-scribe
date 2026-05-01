import type { AuthRole, AuthPermission } from '@/types/auth.types';

export const ALL_PERMISSIONS = [
  'portfolio:view',
  'portfolio:export',
  'portfolio:analyze',
  'credit:view',
  'credit:purchase',
  'credit:retire',
  'credit:approve-retirement',
  'report:view',
  'report:generate',
  'report:export',
  'report:schedule',
  'team:view',
  'team:invite',
  'team:manage-roles',
  'team:remove',
  'compliance:view',
  'compliance:submit',
  'compliance:audit',
  'compliance:verify-retirement',
  'settings:view',
  'settings:update',
  'settings:billing',
  'admin:user-manage',
  'admin:view-audit-logs',
  'audit-hash:anchor',
  'audit-hash:verify',
] as const satisfies readonly AuthPermission[];

export const ROLE_PERMISSIONS: Record<AuthRole, readonly AuthPermission[]> = {
  admin: [...ALL_PERMISSIONS],
  analyst: [
    'portfolio:view',
    'portfolio:export',
    'portfolio:analyze',
    'credit:view',
    'report:view',
    'report:generate',
    'report:export',
    'compliance:view',
    'team:view',
    'audit-hash:verify',
  ],
  manager: [
    'portfolio:view',
    'portfolio:export',
    'credit:view',
    'credit:purchase',
    'credit:retire',
    'credit:approve-retirement',
    'report:view',
    'report:generate',
    'compliance:view',
    'compliance:submit',
    'compliance:verify-retirement',
    'team:view',
    'audit-hash:anchor',
    'audit-hash:verify',
  ],
  viewer: [
    'portfolio:view',
    'credit:view',
    'report:view',
    'compliance:view',
    'team:view',
  ],
  auditor: [
    'portfolio:view',
    'portfolio:export',
    'report:view',
    'report:export',
    'compliance:view',
    'compliance:audit',
    'compliance:verify-retirement',
    'admin:view-audit-logs',
    'audit-hash:anchor',
    'audit-hash:verify',
  ],
};

const ROUTE_ROLE_RULES: Array<{
  prefix: string;
  allowedRoles: readonly AuthRole[];
  denyMessage: string;
}> = [
  {
    prefix: '/team',
    allowedRoles: ['admin'],
    denyMessage: 'Only admins can access team management.',
  },
  {
    prefix: '/audit',
    allowedRoles: ['admin', 'auditor'],
    denyMessage: 'Only admins and auditors can view audit logs.',
  },
];

export interface RouteAccessResult {
  allowed: boolean;
  reason?: string;
}

export function normalizeRole(role: string | null | undefined): AuthRole {
  const value = (role ?? '').toLowerCase();
  if (value === 'admin' || value === 'manager' || value === 'analyst' || value === 'auditor') {
    return value;
  }
  return 'viewer';
}

export function getPermissionsForRole(role: string | null | undefined): AuthPermission[] {
  const normalized = normalizeRole(role);
  return [...ROLE_PERMISSIONS[normalized]];
}

export function hasPermission(
  role: string | null | undefined,
  permission: AuthPermission,
): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function canAccessRoute(
  pathname: string,
  role: string | null | undefined,
): RouteAccessResult {
  const normalized = normalizeRole(role);
  const match = ROUTE_ROLE_RULES.find((rule) => pathname.startsWith(rule.prefix));

  if (!match) {
    return { allowed: true };
  }

  const allowed = match.allowedRoles.includes(normalized);
  return allowed ? { allowed: true } : { allowed: false, reason: match.denyMessage };
}
