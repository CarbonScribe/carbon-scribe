'use client';

import { X, Loader2, Calendar, User } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import { TaskStatuses, TaskPriorities } from '@/lib/store/collaboration/collaboration.types';
import type { Task } from '@/lib/store/collaboration/collaboration.types';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const updateTask = useStore((s) => s.updateTask);
  const loading = useStore((s) => s.collaborationLoading.updateTask);

  if (!isOpen || !task) return null;

  const handleStatusChange = async (newStatus: string) => {
    const updated = await updateTask(task.id, { status: newStatus });
    if (updated) showToast('success', 'Status updated.');
    else showToast('error', 'Failed to update.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 pr-4">{task.title}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {task.description && <p className="text-gray-600 mb-4 whitespace-pre-wrap">{task.description}</p>}
        <div className="flex flex-wrap gap-2 mb-4">
          {task.due_date && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              Due {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {task.assigned_to && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <User className="w-4 h-4" />
              Assigned to {task.assigned_to}
            </span>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            {TaskStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
          Created {new Date(task.created_at).toLocaleString()} · Updated {new Date(task.updated_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
