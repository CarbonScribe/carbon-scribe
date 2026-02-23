'use client';

import { useEffect } from 'react';
import ProjectStatsDashboard from '@/components/dashboard/ProjectStatsDashboard';
import ActiveProjectsGrid from '@/components/projects/ActiveProjectsGrid';
import MonitoringAlerts from '@/components/monitoring/MonitoringAlerts';
import SatelliteInsights from '@/components/insights/SatelliteInsights';
import TokenizationStatus from '@/components/financing/TokenizationStatus';
import QuickActionsPanel from '@/components/actions/QuickActionsPanel';
import { useStore } from '@/lib/store/store';

export default function ProjectPortalHome() {
  const fetchProjects = useStore((state) => state.fetchProjects);
  const name = useStore((s) => s.user?.full_name) || 'Farmer';

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome back, {name}! 🌱</h1>
            <p className="text-emerald-100 opacity-90">Your land is sequestering carbon right now. Let&apos;s grow together.</p>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
              <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse mr-2"></div>
              <span className="font-medium">Live Carbon Capture: 12.4 tCO₂</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Projects & Stats */}
        <div className="lg:col-span-2 space-y-6">
          <ProjectStatsDashboard />
          <ActiveProjectsGrid />
          <MonitoringAlerts />
        </div>

        {/* Right Column - Insights & Actions */}
        <div className="space-y-6">
          <SatelliteInsights />
          <TokenizationStatus />
          <QuickActionsPanel />
        </div>
      </div>

      {/* Bottom Row - Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Soil Health Index', value: '84%', icon: '🌱', trend: '+5%', color: 'bg-emerald-500' },
          { label: 'Biodiversity Score', value: '76%', icon: '🦋', trend: '+8%', color: 'bg-teal-500' },
          { label: 'Water Retention', value: '92%', icon: '💧', trend: '+12%', color: 'bg-cyan-500' },
          { label: 'Community Impact', value: '95%', icon: '👨‍👩‍👧‍👦', trend: '+3%', color: 'bg-purple-500' },
        ].map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${metric.color} bg-opacity-10`}>
                <span className="text-xl">{metric.icon}</span>
              </div>
              <span className="text-sm font-medium text-emerald-600">{metric.trend}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
            <div className="text-sm text-gray-600">{metric.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
