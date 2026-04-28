/**
 * Team Management API client.
 * All requests include the JWT from localStorage (key: "access_token").
 */

import type {
  TeamMember,
  TeamRole,
  Invitation,
  CreateMemberPayload,
  UpdateMemberPayload,
  CreateRolePayload,
  UpdateRolePayload,
  InviteMemberPayload,
} from '@/types/team'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const TEAM_BASE = `${BASE_URL}/api/v1/team`

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: getAuthHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Members ──────────────────────────────────────────────────────────────────

export const teamApi = {
  // Members
  listMembers: () => request<TeamMember[]>(`${TEAM_BASE}/members`),

  getMember: (id: string) => request<TeamMember>(`${TEAM_BASE}/members/${id}`),

  createMember: (payload: CreateMemberPayload) =>
    request<TeamMember>(`${TEAM_BASE}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMember: (id: string, payload: UpdateMemberPayload) =>
    request<TeamMember>(`${TEAM_BASE}/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deactivateMember: (id: string) =>
    request<TeamMember>(`${TEAM_BASE}/members/${id}`, { method: 'DELETE' }),

  reactivateMember: (id: string) =>
    request<TeamMember>(`${TEAM_BASE}/members/${id}/reactivate`, {
      method: 'POST',
    }),

  assignRole: (memberId: string, roleId: string) =>
    request<TeamMember>(`${TEAM_BASE}/members/${memberId}/role`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
    }),

  // Roles
  listRoles: () => request<TeamRole[]>(`${TEAM_BASE}/roles`),

  createRole: (payload: CreateRolePayload) =>
    request<TeamRole>(`${TEAM_BASE}/roles`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRole: (id: string, payload: UpdateRolePayload) =>
    request<TeamRole>(`${TEAM_BASE}/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteRole: (id: string) =>
    request<void>(`${TEAM_BASE}/roles/${id}`, { method: 'DELETE' }),

  // Permissions
  listPermissions: () => request<string[]>(`${TEAM_BASE}/permissions`),

  myPermissions: () => request<string[]>(`${TEAM_BASE}/permissions/my`),

  // Invitations
  inviteMember: (payload: InviteMemberPayload) =>
    request<Invitation>(`${TEAM_BASE}/invitations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listInvitations: () => request<Invitation[]>(`${TEAM_BASE}/invitations`),

  resendInvitation: (id: string) =>
    request<Invitation>(`${TEAM_BASE}/invitations/${id}/resend`, {
      method: 'POST',
    }),

  cancelInvitation: (id: string) =>
    request<void>(`${TEAM_BASE}/invitations/${id}`, { method: 'DELETE' }),
}
