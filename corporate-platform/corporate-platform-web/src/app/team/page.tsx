'use client'

import { useState } from 'react'
import {
  Users, UserPlus, Shield, Clock, BarChart3, Search, Filter,
  Mail, Calendar, Edit, Trash2, RefreshCw, CheckCircle, AlertCircle,
  Target, ChevronRight, X, Send,
} from 'lucide-react'
import {
  Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell,
} from 'recharts'
import { useTeam } from '@/hooks/useTeam'
import AddMemberModal from '@/components/team/AddMemberModal'
import EditMemberModal from '@/components/team/EditMemberModal'
import InviteMemberModal from '@/components/team/InviteMemberModal'
import ManageRoleModal from '@/components/team/ManageRoleModal'
import type { TeamMember, TeamRole } from '@/types/team'

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#0073e6', MANAGER: '#8b5cf6', ANALYST: '#00d4aa',
  VIEWER: '#f59e0b', AUDITOR: '#ef4444',
}
const roleColor = (name: string) => ROLE_COLORS[name.toUpperCase()] ?? '#6b7280'

const statusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  }
}

const memberInitials = (m: TeamMember) => {
  const f = m.firstName?.[0] ?? ''
  const l = m.lastName?.[0] ?? ''
  return (f + l).toUpperCase() || m.email[0].toUpperCase()
}

const memberDisplayName = (m: TeamMember) =>
  [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email

export default function TeamPage() {
  const {
    members, roles, invitations, permissions, loading, error,
    fetchAll, createMember, updateMember, deactivateMember, reactivateMember,
    assignRole, createRole, updateRole, deleteRole, inviteMember,
    resendInvitation, cancelInvitation,
  } = useTeam()

  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'invitations'>('members')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [modal, setModal] = useState<
    | { type: 'addMember' }
    | { type: 'editMember'; member: TeamMember }
    | { type: 'invite' }
    | { type: 'createRole' }
    | { type: 'editRole'; role: TeamRole }
    | null
  >(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const notify = (msg: string, isError = false) => {
    if (isError) { setActionError(msg); setTimeout(() => setActionError(null), 4000) }
    else { setActionSuccess(msg); setTimeout(() => setActionSuccess(null), 3000) }
  }

  const filteredMembers = members.filter((m) => {
    const q = searchTerm.toLowerCase()
    return (
      memberDisplayName(m).toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.role?.name ?? '').toLowerCase().includes(q)
    )
  })

  const activeCount = members.filter((m) => m.status === 'ACTIVE').length
  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING')

  const roleDistribution = roles.map((r) => ({
    name: r.name, value: r.memberCount, color: roleColor(r.name),
  }))

  return (
    <div className="space-y-6 animate-in">
      {/* Toast notifications */}
      {actionError && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg">
          <AlertCircle size={16} /> {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl shadow-lg">
          <CheckCircle size={16} /> {actionSuccess}
        </div>
      )}

      {/* Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">Team Management</h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Manage your sustainability team, assign roles, and control permissions.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-30">
              <div className="text-sm text-blue-200 mb-1">Members</div>
              <div className="text-2xl font-bold">{members.length}</div>
              <div className="text-xs text-green-300">{activeCount} active</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-30">
              <div className="text-sm text-blue-200 mb-1">Pending Invites</div>
              <div className="text-2xl font-bold">{pendingInvitations.length}</div>
              <div className="text-xs text-blue-300">awaiting response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="corporate-card p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle size={16} /> {error}
          </div>
          <button onClick={fetchAll} className="flex items-center gap-1 text-sm text-corporate-blue hover:underline">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="corporate-card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'members', label: 'Team Members', icon: Users },
            { id: 'roles', label: 'Roles & Permissions', icon: Shield },
            { id: 'invitations', label: 'Invitations', icon: Mail, badge: pendingInvitations.length },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-corporate-blue text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={18} className="mr-2" />
                {tab.label}
                {tab.badge ? (
                  <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{tab.badge}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Members Tab ── */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="corporate-card p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="search"
                  placeholder="Search by name, email, or role..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModal({ type: 'invite' })} className="corporate-btn-secondary px-4 py-2 flex items-center">
                  <Mail size={16} className="mr-2" /> Invite
                </button>
                <button onClick={() => setModal({ type: 'addMember' })} className="corporate-btn-primary px-4 py-2 flex items-center">
                  <UserPlus size={16} className="mr-2" /> Add Member
                </button>
              </div>
            </div>
          </div>

          {loading && !members.length ? (
            <div className="corporate-card p-12 text-center text-gray-500">Loading team members...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className={`corporate-card p-5 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                    selectedMember?.id === member.id ? 'ring-2 ring-corporate-blue' : ''
                  }`}
                  onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mr-3"
                        style={{ backgroundColor: roleColor(member.role?.name ?? '') }}
                      >
                        {memberInitials(member)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{memberDisplayName(member)}</h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{member.role?.name ?? '—'}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(member.status)}`}>
                      {member.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Mail size={14} className="mr-2 shrink-0" /> {member.email}
                    </div>
                    {member.title && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Target size={14} className="mr-2 shrink-0" /> {member.title}
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Calendar size={14} className="mr-2 shrink-0" />
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {member.role?.permissions && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Permissions</div>
                      <div className="flex flex-wrap gap-1">
                        {(member.role.permissions as string[]).slice(0, 4).map((p) => (
                          <span key={p} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                            {p.split(':')[1]}
                          </span>
                        ))}
                        {(member.role.permissions as string[]).length > 4 && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs">
                            +{(member.role.permissions as string[]).length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      className="flex-1 corporate-btn-secondary text-sm px-3 py-2 flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); setModal({ type: 'editMember', member }) }}
                    >
                      <Edit size={14} className="mr-1" /> Edit
                    </button>
                    {member.status === 'ACTIVE' ? (
                      <button
                        className="flex-1 text-sm px-3 py-2 flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                        onClick={async (e) => {
                          e.stopPropagation()
                          try { await deactivateMember(member.id); notify('Member deactivated') }
                          catch (err) { notify(err instanceof Error ? err.message : 'Failed', true) }
                        }}
                      >
                        <Trash2 size={14} className="mr-1" /> Deactivate
                      </button>
                    ) : (
                      <button
                        className="flex-1 text-sm px-3 py-2 flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                        onClick={async (e) => {
                          e.stopPropagation()
                          try { await reactivateMember(member.id); notify('Member reactivated') }
                          catch (err) { notify(err instanceof Error ? err.message : 'Failed', true) }
                        }}
                      >
                        <RefreshCw size={14} className="mr-1" /> Reactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {!loading && filteredMembers.length === 0 && (
                <div className="col-span-3 corporate-card p-12 text-center text-gray-500">
                  {searchTerm ? 'No members match your search.' : 'No team members yet. Add one to get started.'}
                </div>
              )}
            </div>
          )}

          {/* Selected member detail panel */}
          {selectedMember && (
            <div className="corporate-card p-6 animate-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Member Details</h2>
                <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {[
                    { label: 'Email', value: selectedMember.email },
                    { label: 'Department', value: selectedMember.department },
                    { label: 'Title', value: selectedMember.title },
                    { label: 'Status', value: selectedMember.status },
                    { label: 'Role', value: selectedMember.role?.name },
                    { label: 'Joined', value: new Date(selectedMember.joinedAt).toLocaleDateString() },
                    { label: 'Last Active', value: selectedMember.lastActiveAt ? new Date(selectedMember.lastActiveAt).toLocaleDateString() : '—' },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
                    </div>
                  ) : null)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">All Permissions</div>
                  <div className="flex flex-wrap gap-1">
                    {(selectedMember.role?.permissions as string[] ?? []).map((p) => (
                      <span key={p} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Roles Tab ── */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Define access levels for your team</p>
              </div>
              <button onClick={() => setModal({ type: 'createRole' })} className="corporate-btn-primary px-4 py-2 flex items-center">
                <Shield size={16} className="mr-2" /> Create Role
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart */}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Role Distribution</h3>
                {roleDistribution.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                          {roleDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} members`, 'Count']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-400">No roles yet</div>
                )}
              </div>

              {/* Role list */}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">All Roles</h3>
                {loading && !roles.length ? (
                  <div className="text-gray-500 text-sm">Loading roles...</div>
                ) : (
                  <div className="space-y-4">
                    {roles.map((role) => (
                      <div key={role.id} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: roleColor(role.name) }} />
                            <h4 className="font-bold text-gray-900 dark:text-white">{role.name}</h4>
                            {role.isSystem && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">system</span>
                            )}
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{role.memberCount} member{role.memberCount !== 1 ? 's' : ''}</span>
                        </div>
                        {role.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{role.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(role.permissions as string[]).slice(0, 5).map((p) => (
                            <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">{p}</span>
                          ))}
                          {(role.permissions as string[]).length > 5 && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded text-xs">+{(role.permissions as string[]).length - 5}</span>
                          )}
                        </div>
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setModal({ type: 'editRole', role })}
                            className="text-sm text-corporate-blue hover:underline flex items-center gap-1"
                          >
                            <Edit size={13} /> Edit
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={async () => {
                                try { await deleteRole(role.id); notify('Role deleted') }
                                catch (err) { notify(err instanceof Error ? err.message : 'Failed', true) }
                              }}
                              className="text-sm text-red-600 hover:underline flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invitations Tab ── */}
      {activeTab === 'invitations' && (
        <div className="space-y-6">
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invitations</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending and past team invitations</p>
              </div>
              <button onClick={() => setModal({ type: 'invite' })} className="corporate-btn-primary px-4 py-2 flex items-center">
                <Send size={16} className="mr-2" /> Invite Member
              </button>
            </div>

            {loading && !invitations.length ? (
              <div className="text-center text-gray-500 py-8">Loading invitations...</div>
            ) : invitations.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No invitations yet.</div>
            ) : (
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Mail className="text-corporate-blue" size={18} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{inv.email}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Role: {inv.role?.name ?? inv.roleId} · Sent {new Date(inv.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                      {inv.status === 'PENDING' && (
                        <>
                          <button
                            onClick={async () => {
                              try { await resendInvitation(inv.id); notify('Invitation resent') }
                              catch (err) { notify(err instanceof Error ? err.message : 'Failed', true) }
                            }}
                            className="text-sm text-corporate-blue hover:underline"
                          >
                            Resend
                          </button>
                          <button
                            onClick={async () => {
                              try { await cancelInvitation(inv.id); notify('Invitation cancelled') }
                              catch (err) { notify(err instanceof Error ? err.message : 'Failed', true) }
                            }}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal?.type === 'addMember' && (
        <AddMemberModal
          roles={roles}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const result = await createMember(payload)
            if (result) notify('Member added successfully')
            else throw new Error('Failed to add member')
          }}
        />
      )}

      {modal?.type === 'editMember' && (
        <EditMemberModal
          member={modal.member}
          roles={roles}
          onClose={() => setModal(null)}
          onUpdate={async (id, payload) => {
            const result = await updateMember(id, payload)
            if (!result) throw new Error('Failed to update member')
          }}
          onAssignRole={async (memberId, roleId) => {
            const result = await assignRole(memberId, roleId)
            if (!result) throw new Error('Failed to assign role')
            notify('Member updated successfully')
          }}
        />
      )}

      {modal?.type === 'invite' && (
        <InviteMemberModal
          roles={roles}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const result = await inviteMember(payload)
            if (result) notify('Invitation sent')
            else throw new Error('Failed to send invitation')
          }}
        />
      )}

      {modal?.type === 'createRole' && (
        <ManageRoleModal
          availablePermissions={permissions}
          onClose={() => setModal(null)}
          onCreate={async (payload) => {
            const result = await createRole(payload)
            if (result) notify('Role created')
            else throw new Error('Failed to create role')
          }}
        />
      )}

      {modal?.type === 'editRole' && (
        <ManageRoleModal
          role={modal.role}
          availablePermissions={permissions}
          onClose={() => setModal(null)}
          onUpdate={async (id, payload) => {
            const result = await updateRole(id, payload)
            if (result) notify('Role updated')
            else throw new Error('Failed to update role')
          }}
        />
      )}
    </div>
  )
}
