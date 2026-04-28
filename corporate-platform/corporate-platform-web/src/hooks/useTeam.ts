'use client'

import { useState, useCallback, useEffect } from 'react'
import { teamApi } from '@/lib/teamApi'
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

export function useTeam() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [roles, setRoles] = useState<TeamRole[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)
      try {
        return await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred')
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, r, inv, perms] = await Promise.all([
        teamApi.listMembers(),
        teamApi.listRoles(),
        teamApi.listInvitations(),
        teamApi.listPermissions(),
      ])
      setMembers(m)
      setRoles(r)
      setInvitations(inv)
      setPermissions(perms)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Members
  const createMember = useCallback(
    async (payload: CreateMemberPayload) => {
      const member = await withLoading(() => teamApi.createMember(payload))
      if (member) setMembers((prev) => [member, ...prev])
      return member
    },
    [withLoading],
  )

  const updateMember = useCallback(
    async (id: string, payload: UpdateMemberPayload) => {
      const updated = await withLoading(() => teamApi.updateMember(id, payload))
      if (updated)
        setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
      return updated
    },
    [withLoading],
  )

  const deactivateMember = useCallback(
    async (id: string) => {
      const updated = await withLoading(() => teamApi.deactivateMember(id))
      if (updated)
        setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
      return updated
    },
    [withLoading],
  )

  const reactivateMember = useCallback(
    async (id: string) => {
      const updated = await withLoading(() => teamApi.reactivateMember(id))
      if (updated)
        setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
      return updated
    },
    [withLoading],
  )

  const assignRole = useCallback(
    async (memberId: string, roleId: string) => {
      const updated = await withLoading(() =>
        teamApi.assignRole(memberId, roleId),
      )
      if (updated)
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? updated : m)),
        )
      return updated
    },
    [withLoading],
  )

  // Roles
  const createRole = useCallback(
    async (payload: CreateRolePayload) => {
      const role = await withLoading(() => teamApi.createRole(payload))
      if (role) setRoles((prev) => [...prev, role])
      return role
    },
    [withLoading],
  )

  const updateRole = useCallback(
    async (id: string, payload: UpdateRolePayload) => {
      const updated = await withLoading(() => teamApi.updateRole(id, payload))
      if (updated)
        setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)))
      return updated
    },
    [withLoading],
  )

  const deleteRole = useCallback(
    async (id: string) => {
      const result = await withLoading(() => teamApi.deleteRole(id))
      if (result !== null) setRoles((prev) => prev.filter((r) => r.id !== id))
      return result
    },
    [withLoading],
  )

  // Invitations
  const inviteMember = useCallback(
    async (payload: InviteMemberPayload) => {
      const inv = await withLoading(() => teamApi.inviteMember(payload))
      if (inv) setInvitations((prev) => [inv, ...prev])
      return inv
    },
    [withLoading],
  )

  const resendInvitation = useCallback(
    async (id: string) => {
      return withLoading(() => teamApi.resendInvitation(id))
    },
    [withLoading],
  )

  const cancelInvitation = useCallback(
    async (id: string) => {
      const result = await withLoading(() => teamApi.cancelInvitation(id))
      if (result !== null)
        setInvitations((prev) => prev.filter((i) => i.id !== id))
      return result
    },
    [withLoading],
  )

  return {
    members,
    roles,
    invitations,
    permissions,
    loading,
    error,
    fetchAll,
    createMember,
    updateMember,
    deactivateMember,
    reactivateMember,
    assignRole,
    createRole,
    updateRole,
    deleteRole,
    inviteMember,
    resendInvitation,
    cancelInvitation,
  }
}
