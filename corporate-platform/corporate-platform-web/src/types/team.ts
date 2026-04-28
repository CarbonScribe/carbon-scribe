// Team Management Types

export interface TeamRole {
  id: string
  companyId: string
  name: string
  description?: string
  isSystem: boolean
  permissions: string[]
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface TeamMember {
  id: string
  companyId: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  roleId: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  joinedAt: string
  invitedBy: string | null
  invitedAt: string | null
  lastActiveAt: string | null
  metadata?: Record<string, unknown>
  department: string | null
  title: string | null
  role?: TeamRole
}

export interface Invitation {
  id: string
  companyId: string
  email: string
  roleId: string
  invitedBy: string
  token: string
  expiresAt: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  acceptedAt: string | null
  createdAt: string
  role?: TeamRole
}

export interface CreateMemberPayload {
  userId?: string
  email: string
  firstName?: string
  lastName?: string
  roleId: string
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  department?: string
  title?: string
}

export interface UpdateMemberPayload {
  firstName?: string
  lastName?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  department?: string
  title?: string
}

export interface CreateRolePayload {
  name: string
  description?: string
  permissions: string[]
}

export interface UpdateRolePayload {
  description?: string
  permissions?: string[]
}

export interface InviteMemberPayload {
  email: string
  roleId: string
}
