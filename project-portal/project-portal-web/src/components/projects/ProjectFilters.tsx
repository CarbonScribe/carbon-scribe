'use client';

import { Search, Filter } from 'lucide-react';
import { useStore } from '@/lib/store/store';

const PROJECT_TYPES = [
  'All',
  'Reforestation',
  'Agroforestry',
  'Blue Carbon',
  'Regenerative Farming',
  'REDD+',
  'Afforestation',
];

const STATUSES = ['All', 'active', 'completed', 'pending'];

const ProjectFilters = () => {
  const filters = useStore((state) => state.filters);
  const setFilters = useStore((state) => state.setFilters);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Search */}
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search projects by name or location..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ProjectFilters;
