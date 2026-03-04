'use client';

import { useEffect, useState } from 'react';
import { CheckSquare, Loader2, Plus } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { useTasksByStatus } from '@/lib/store/collaboration/collaboration.selectors';
import { TaskStatuses } from '@/lib/store/collaboration/collaboration.types';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import TaskDetailModal from './TaskDetailModal';
import type { Task } from '@/lib/store/collaboration/collaboration.types';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
};

interface TaskBoardProps {
  projectId: string;
}

export default function TaskBoard({ projectId }: TaskBoardProps) {
  const fetchTasks = useStore((s) => s.fetchTasks);
  const loading = useStore((s) => s.collaborationLoading.tasks);
  const tasksByStatus = useTasksByStatus();

  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchTasks(projectId);
  }, [projectId, fetchTasks]);

  const openDetail = (task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-600" />
          Tasks
        </h3>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>
      {showForm && (
        <TaskForm
          projectId={projectId}
          onSuccess={() => { setShowForm(false); fetchTasks(projectId); }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TaskStatuses.map((statusKey) => {
          const tasks = tasksByStatus[statusKey] ?? [];
          return (
            <div key={statusKey} className="bg-gray-50 rounded-xl border border-gray-200 p-3 min-h-[120px]">
              <div className="font-medium text-gray-700 mb-3 flex items-center justify-between">
                <span>{STATUS_LABELS[statusKey] ?? statusKey}</span>
                <span className="text-xs text-gray-500">{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.map((t) => (
                  <TaskCard key={t.id} task={t} onClick={() => openDetail(t)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <TaskDetailModal
        task={selectedTask}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedTask(null); fetchTasks(projectId); }}
      />
    </div>
  );
}
