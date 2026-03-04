'use client';

import { Users, Loader2, UserMinus } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { ROLES_CAN_MANAGE } from '@/lib/store/collaboration/collaboration.types';
import RoleBadge from './RoleBadge';
import type { ProjectMember } from '@/lib/store/collaboration/collaboration.types';

interface TeamMembersListProps {
  projectId: string;
  canManage: boolean;
}

function MemberRow({
  member,
  projectId,
  canRemove,
  onRemove,
}: {
  member: ProjectMember;
  projectId: string;
  canRemove: boolean;
  onRemove: (userId: string) => void;
}) {
  const removing = useStore((s) => s.collaborationLoading.removeMember);
  const isOwner = member.role === ROLES_CAN_MANAGE[0]; // Owner cannot be removed
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium">
          {(member.user_id ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-medium text-gray-900">{member.user_id}</div>
          <div className="text-sm text-gray-500">Joined {new Date(member.joined_at).toLocaleDateString()}</div>
        </div>
        <RoleBadge role={member.role} />
      </div>
      {canRemove && !isOwner && (
        <button
          type="button"
          onClick={() => onRemove(member.user_id)}
          disabled={removing}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Remove member"
        >
          {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

export default function TeamMembersList({ projectId, canManage }: TeamMembersListProps) {
  const members = useStore((s) => s.members);
  const loading = useStore((s) => s.collaborationLoading.members);
  const removeMember = useStore((s) => s.removeMember);

  const handleRemove = (userId: string) => {
    removeMember(projectId, userId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No team members yet. Invite people to collaborate.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          projectId={projectId}
          canRemove={canManage}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
