'use client';

import { TrendingUp, Trees, Coins, Globe, Droplets, Leaf } from 'lucide-react';
import { useProjectStats } from '@/lib/store/projects/projects.selectors';
import { useStore } from '@/lib/store/store';

const ProjectStatsDashboard = () => {
  const stats = useProjectStats();
  const isFetching = useStore((state) => state.loading.isFetching);

  // Loading skeleton for stats
  if (isFetching && stats.totalProjects === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-44 bg-gray-200 rounded" />
          <div className="h-5 w-48 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="text-center p-4 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-gray-200 mx-auto mb-3" />
              <div className="h-7 w-16 bg-gray-200 rounded mx-auto mb-1" />
              <div className="h-4 w-20 bg-gray-200 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statItems = [
    {
      icon: Trees,
      label: 'Total Projects',
      value: stats.totalProjects.toLocaleString(),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: Coins,
      label: 'Credits Generated',
      value: stats.totalCarbonCredits.toLocaleString(),
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      icon: Globe,
      label: 'Area Covered',
      value: `${stats.totalArea.toFixed(1)} ha`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Droplets,
      label: 'Active Projects',
      value: stats.activeProjects.toLocaleString(),
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      icon: Leaf,
      label: 'Total Farmers',
      value: stats.totalFarmers.toLocaleString(),
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      icon: TrendingUp,
      label: 'Avg Progress',
      value: `${stats.averageProgress}%`,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Project Performance</h2>
        <div className="flex items-center text-emerald-600">
          <TrendingUp className="w-5 h-5 mr-2" />
          <span className="font-medium">
            {stats.completedProjects} completed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className="text-center p-4 rounded-xl hover:scale-105 transition-transform duration-200"
          >
            <div
              className={`inline-flex p-3 rounded-full ${stat.bg} ${stat.color} mb-3`}
            >
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="mt-8 space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">
              Average Project Progress
            </span>
            <span className="font-bold text-gray-900">
              {stats.averageProgress}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.averageProgress}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">
              Completion Rate
            </span>
            <span className="font-bold text-gray-900">
              {stats.totalProjects > 0
                ? Math.round(
                    (stats.completedProjects / stats.totalProjects) * 100
                  )
                : 0}
              %
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
              style={{
                width: `${
                  stats.totalProjects > 0
                    ? Math.round(
                        (stats.completedProjects / stats.totalProjects) * 100
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectStatsDashboard;
