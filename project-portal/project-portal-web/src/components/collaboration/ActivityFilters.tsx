'use client';

import { useStore } from '@/lib/store/store';
import { ActivityTypes } from '@/lib/store/collaboration/collaboration.types';

const filterOptions = ['All', ...ActivityTypes];

export default function ActivityFilters() {
  const activityTypeFilter = useStore((s) => s.activityTypeFilter);
  const setActivityTypeFilter = useStore((s) => s.setActivityTypeFilter);

  return (
    <div className="flex flex-wrap gap-2">
      {filterOptions.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => setActivityTypeFilter(type)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activityTypeFilter === type
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}
