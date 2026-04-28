'use client'

import { useState } from 'react'
import { X, Shield } from 'lucide-react'
import type { TeamRole, CreateRolePayload, UpdateRolePayload } from '@/types/team'

interface Props {
  role?: TeamRole // undefined = create mode
  availablePermissions: string[]
  onClose: () => void
  onCreate?: (payload: CreateRolePayload) => Promise<unknown>
  onUpdate?: (id: string, payload: UpdateRolePayload) => Promise<unknown>
}

export default function ManageRoleModal({ role, availablePermissions, onClose, onCreate, onUpdate }: Props) {
  const isEdit = !!role
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selectedPerms, setSelectedPerms] = useState<string[]>(role?.permissions ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }

  // Group permissions by category prefix (e.g. "portfolio", "credit")
  const grouped = availablePermissions.reduce<Record<string, string[]>>((acc, perm) => {
    const category = perm.split(':')[0]
    if (!acc[category]) acc[category] = []
    acc[category].push(perm)
    return acc
  }, {})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit && onUpdate && role) {
        await onUpdate(role.id, { description, permissions: selectedPerms })
      } else if (!isEdit && onCreate) {
        await onCreate({ name, description, permissions: selectedPerms })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Shield className="text-purple-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEdit ? `Edit Role: ${role.name}` : 'Create Role'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Analyst"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-corporate-blue"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-corporate-blue resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Permissions
              <span className="ml-2 text-xs text-gray-500">({selectedPerms.length} selected)</span>
            </label>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {Object.entries(grouped).map(([category, perms]) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 capitalize">
                    {category}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {perms.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPerms.includes(perm)}
                          onChange={() => togglePerm(perm)}
                          className="rounded border-gray-300 text-corporate-blue focus:ring-corporate-blue"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{perm.split(':')[1]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 corporate-btn-secondary py-2">Cancel</button>
            <button type="submit" disabled={submitting || (isEdit && !!role?.isSystem)} className="flex-1 corporate-btn-primary py-2 disabled:opacity-50">
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
          {isEdit && role?.isSystem && (
            <p className="text-xs text-center text-amber-600 dark:text-amber-400">System roles cannot be modified.</p>
          )}
        </form>
      </div>
    </div>
  )
}
