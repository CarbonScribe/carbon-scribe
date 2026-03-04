'use client';

import { useEffect } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { useFilteredActivities } from '@/lib/store/collaboration/collaboration.selectors';
import ActivityItem from './ActivityItem';
import ActivityFilters from './ActivityFilters';

interface ActivityTimelineProps {
  projectId: string;
}

export default function ActivityTimeline({ projectId }: ActivityTimelineProps) {
  const fetchActivities = useStore((s) => s.fetchActivities);
  const loading = useStore((s) => s.collaborationLoading.activities);
  const activities = useFilteredActivities();

  useEffect(() => {
    fetchActivities(projectId, 20, 0);
  }, [projectId, fetchActivities]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          Activity
        </h3>
        <ActivityFilters />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No activity yet for this project.</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {activities.map((a) => (
            <ActivityItem key={a.id} activity={a} />
          ))}
        </div>
      )}
    </div>
  );
}
