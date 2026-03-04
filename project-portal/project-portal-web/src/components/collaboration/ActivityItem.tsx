'use client';

import { Activity, User, Bot, AlertCircle } from 'lucide-react';
import type { ActivityLog } from '@/lib/store/collaboration/collaboration.types';

interface ActivityItemProps {
  activity: ActivityLog;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  system: Bot,
  user: User,
  automated: Activity,
  alert: AlertCircle,
};

const typeColors: Record<string, string> = {
  system: 'bg-gray-100 text-gray-600',
  user: 'bg-emerald-100 text-emerald-600',
  automated: 'bg-blue-100 text-blue-600',
  alert: 'bg-amber-100 text-amber-600',
};

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = typeIcons[activity.type] ?? Activity;
  const colorClass = typeColors[activity.type] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900">
          <span className="font-medium">{formatAction(activity.action)}</span>
          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
            <span className="text-gray-600">
              {' — '}
              {Object.entries(activity.metadata)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(', ')}
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{formatTime(activity.created_at)}</p>
      </div>
    </div>
  );
}
