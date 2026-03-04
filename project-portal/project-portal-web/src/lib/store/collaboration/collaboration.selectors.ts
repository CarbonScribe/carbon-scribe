import { useStore } from '../store';
import type { ActivityLog, Comment, Task } from './collaboration.types';
import { TaskStatuses } from './collaboration.types';
import { ROLES_CAN_MANAGE } from './collaboration.types';

/**
 * Select activities filtered by type (for activity feed).
 */
export function useFilteredActivities(): ActivityLog[] {
  const activities = useStore((s) => s.activities);
  const activityTypeFilter = useStore((s) => s.activityTypeFilter);
  if (activityTypeFilter === 'All') return activities;
  return activities.filter((a) => a.type === activityTypeFilter);
}

/**
 * Select root comments (no parent) for threading.
 */
export function useRootComments(): Comment[] {
  const comments = useStore((s) => s.comments);
  return comments.filter((c) => !c.parent_id);
}

/**
 * Select replies for a given comment id.
 */
export function useRepliesForComment(parentId: string): Comment[] {
  const comments = useStore((s) => s.comments);
  return comments.filter((c) => c.parent_id === parentId);
}

/**
 * Select tasks grouped by status for Kanban.
 */
export function useTasksByStatus(): Record<string, Task[]> {
  const tasks = useStore((s) => s.tasks);
  const grouped = Object.fromEntries(TaskStatuses.map((s) => [s, [] as Task[]])) as Record<string, Task[]>;
  for (const t of tasks) {
    const status = TaskStatuses.includes(t.status as (typeof TaskStatuses)[number]) ? t.status : 'todo';
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(t);
  }
  return grouped;
}

/**
 * Select pending invitations for the current project.
 */
export function usePendingInvitations() {
  const invitations = useStore((s) => s.invitations);
  return invitations.filter((i) => i.status === 'pending');
}

/**
 * Check if current user can invite (e.g. Owner or Manager). Uses members + first member as owner fallback.
 */
export function useCanInvite(projectId: string | null): boolean {
  const members = useStore((s) => s.members);
  if (!projectId || members.length === 0) return false;
  return members.some((m) => m.project_id === projectId && (ROLES_CAN_MANAGE as readonly string[]).includes(m.role));
}
