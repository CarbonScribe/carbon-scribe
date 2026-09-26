'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store/store';

// Dashboard
import SystemStatusBanner from '@/components/monitoring/dashboard/SystemStatusBanner';
import ComponentStatusGrid from '@/components/monitoring/dashboard/ComponentStatusGrid';

// Alerts
import MonitoringAlerts from '@/components/monitoring/MonitoringAlerts';

// Satellite insights
import SatelliteInsights from '@/components/insights/SatelliteInsights';

// Services and visualization
import ServiceHealthTable from '@/components/monitoring/services/ServiceHealthTable';

// Visualization
import DependencyGraph from '@/components/monitoring/visualization/DependencyGraph';

// Breadcrumb
import Link from 'next/link';

/** Skeleton loaders */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 animate-pulse rounded-xl ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm animate-pulse space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-40 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm animate-pulse" aria-hidden="true">
      <Skeleton className="h-5 w-40 mb-6" />
      <div className="h-48 flex items-end gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-t-sm"
            style={{ height: `${30 + (i % 5) * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 border shadow-sm animate-pulse">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function DeveloperProjectMonitoringPage() {
  const params = useParams();
  const projectId = params?.id as string;

  // Health store actions
  const fetchDetailedStatus = useStore((state) => state.fetchDetailedStatus);
  const fetchServices = useStore((state) => state.fetchServices);
  const fetchAlerts = useStore((state) => state.fetchAlerts);
  const fetchDependencies = useStore((state) => state.fetchDependencies);

  // Geospatial actions are exposed through the unified store
  const fetchProjectGeometry = useStore((state) => state.fetchProjectGeometry);

  // Loading and error states from health store
  const statusLoading = useStore((state) => state.healthLoading?.isFetchingStatus ?? false);
  const servicesLoading = useStore((state) => state.healthLoading?.isFetchingServices ?? false);
  const alertsLoading = useStore((state) => state.healthLoading?.isFetchingAlerts ?? false);
  const healthErrors = useStore((state) => state.healthErrors);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = statusLoading || servicesLoading || alertsLoading;
  const isRefreshing = refreshing || statusLoading || servicesLoading || alertsLoading;

  const loadData = async () => {
    if (!projectId) return;
    try {
      setError(null);
      await Promise.all([
        fetchDetailedStatus(),
        fetchServices(),
        fetchAlerts(),
        fetchDependencies(),
        // also load geospatial data for satellite insights
        fetchProjectGeometry(projectId),
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load monitoring data';
      setError(message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await loadData();
      if (cancelled) return;
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 pb-20 bg-gray-50/50 min-h-screen">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/developer" className="hover:text-gray-900">
              Developer
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/developer/projects" className="hover:text-gray-900">
              Projects
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span className="text-gray-900 font-medium">Project Monitoring</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Monitoring</h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time monitoring, satellite insights, alerts, and health metrics for this project.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {(error || healthErrors?.status) && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error || healthErrors?.status}
        </div>
      )}

      {/* System status banner */}
      {statusLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <SystemStatusBanner />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Satellite insights with geospatial data */}
          <section aria-label="Satellite Insights" aria-busy={statusLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Satellite Insights</h2>
            <SatelliteInsights projectId={projectId} />
          </section>

          {/* Active alerts */}
          <section aria-label="Active Alerts" aria-busy={alertsLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Active Alerts</h2>
            {alertsLoading ? <SectionSkeleton rows={4} /> : <MonitoringAlerts />}
          </section>

          {/* Service health table */}
          <section aria-label="Service Health" aria-busy={servicesLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Service Health</h2>
            {servicesLoading ? <SectionSkeleton rows={5} /> : <ServiceHealthTable />}
          </section>

          {/* Dependency graph */}
          <section aria-label="Service Dependencies" aria-busy={servicesLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Service Dependencies</h2>
            {servicesLoading ? <SectionSkeleton rows={4} /> : <DependencyGraph />}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Component health grid */}
          <section aria-label="Component Health" aria-busy={servicesLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Component Health</h2>
            {servicesLoading ? <SectionSkeleton rows={3} /> : <ComponentStatusGrid />}
          </section>
        </div>
      </div>
    </div>
  );
}