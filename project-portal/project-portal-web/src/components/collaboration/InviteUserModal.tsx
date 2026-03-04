'use client';

import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import { CollaborationRoles } from '@/lib/store/collaboration/collaboration.types';
import type { CollaborationRole } from '@/lib/store/collaboration/collaboration.types';

interface InviteUserModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteUserModal({ projectId, isOpen, onClose }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaborationRole>('Contributor');

  const inviteUser = useStore((s) => s.inviteUser);
  const loading = useStore((s) => s.collaborationLoading.invite);
  const error = useStore((s) => s.collaborationErrors.invite);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const invited = await inviteUser(projectId, { email: email.trim(), role });
    if (invited) {
      showToast('success', `Invitation sent to ${email}`);
      setEmail('');
      onClose();
    } else if (error) {
      showToast('error', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Invite to project</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as CollaborationRole)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {CollaborationRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
