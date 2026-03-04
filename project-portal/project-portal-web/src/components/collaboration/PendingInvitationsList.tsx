'use client';

import { Mail, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import RoleBadge from './RoleBadge';
import type { ProjectInvitation } from '@/lib/store/collaboration/collaboration.types';

interface PendingInvitationsListProps {
  projectId: string;
}

export default function PendingInvitationsList({ projectId }: PendingInvitationsListProps) {
  const invitations = useStore((s) => s.invitations);
  const loading = useStore((s) => s.collaborationLoading.invitations);

  const pending = invitations.filter((i) => i.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="text-sm text-gray-500 flex items-center gap-2 py-2">
        <Mail className="w-4 h-4" />
        No pending invitations
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {pending.map((inv) => (
        <li
          key={inv.id}
          className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg border border-amber-100"
        >
          <span className="font-medium text-gray-900">{inv.email}</span>
          <RoleBadge role={inv.role} />
          <span className="text-xs text-gray-500">
            Expires {new Date(inv.expires_at).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
