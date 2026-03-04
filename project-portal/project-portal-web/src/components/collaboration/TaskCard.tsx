'use client';

import { Calendar, User, GripVertical } from 'lucide-react';
import type { Task } from '@/lib/store/collaboration/collaboration.types';

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityClass = priorityColors[task.priority] ?? priorityColors.medium;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
          {task.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityClass}`}>
              {task.priority}
            </span>
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.assigned_to && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <User className="w-3 h-3" />
                {task.assigned_to.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
