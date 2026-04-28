'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/lib/store/store';

// Dashboard
import SystemStatusBanner from '@/components/monitoring/dashboard/SystemStatusBanner';
import UptimeStatsCards from '@/components/monitoring/dashboard/UptimeStatsCards';
import ComponentStatusGrid from '@/components/monitoring/dashboard/ComponentStatusGrid';
import ActiveAlertsWidget from '@/components/monitoring/dashboard/ActiveAlertsWidget';

// Services
import ServiceHealthTable from '@/components/monitoring/services/ServiceHealthTable';
import HealthCheckConfigurator from '@/components/monitoring/services/HealthCheckConfigurator';
import CheckResultsTimeline from '@/components/monitoring/services/CheckResultsTimeline';

// Alerts
import AlertsList from '@/components/monitoring/alerts/AlertsList';

// Metrics
import MetricsTimeSeries from '@/components/monitoring/metrics/MetricsTimeSeries';
import MetricSelector from '@/components/monitoring/metrics/MetricSelector';
import ChartControls from '@/components/monitoring/metrics/ChartControls';
import ChartExport from '@/components/monitoring/metrics/ChartExport';

// Visualization
import DependencyGraph from '@/components/monitoring/visualization/DependencyGraph';

// Reports
import DailyReportViewer from '@/components/monitoring/reports/DailyReportViewer';
import UptimeChart from '@/components/monitoring/reports/UptimeChart';
import SLATracker from '@/components/monitoring/reports/SLATracker';
import MaintenanceCalendar from '@/components/monitoring/reports/MaintenanceCalendar';

/** Reusable skeleton block */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 animate-pulse rounded-xl ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a stats-card row */
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

/** Skeleton for a generic card section */
function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm animate-pulse space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-40 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Skeleton for the chart area */
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

export default function SystemHealthDashboard() {
  const fetchDetailedStatus = useStore(state => state.fetchDetailedStatus);
  const fetchServices = useStore(state => state.fetchServices);
  const fetchAlerts = useStore(state => state.fetchAlerts);
  const fetchMetrics = useStore(state => state.fetchMetrics);
  const fetchDependencies = useStore(state => state.fetchDependencies);
  const fetchUptimeStats = useStore(state => state.fetchUptimeStats);
  const clearHealthData = useStore(state => state.clearHealthData);
  const isAuthenticated = useStore(state => state.isAuthenticated);

  // Derive loading state from health store slice
  const statusLoading = useStore(state => state.healthLoading?.isFetchingStatus ?? false);
  const servicesLoading = useStore(state => state.healthLoading?.isFetchingServices ?? false);
  const alertsLoading = useStore(state => state.healthLoading?.isFetchingAlerts ?? false);
  const metricsLoading = useStore(state => state.healthLoading?.isFetchingMetrics ?? false);

  const isLoading = statusLoading || servicesLoading || alertsLoading || metricsLoading;

  useEffect(() => {
    if (isAuthenticated) {
      fetchDetailedStatus();
      fetchServices();
      fetchAlerts();
      fetchMetrics('1h');
      fetchDependencies();
      fetchUptimeStats();
    }

    return () => {
      clearHealthData();
    };
  }, [isAuthenticated, fetchDetailedStatus, fetchServices, fetchAlerts, fetchMetrics, fetchDependencies, fetchUptimeStats, clearHealthData]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="bg-white p-8 border rounded-xl shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-500">Please log in to view the system health dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 pb-20 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time monitoring and metrics for project portal infrastructure.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusLoading ? <Skeleton className="h-14 w-full" /> : <SystemStatusBanner />}

      {/* Uptime Stats */}
      {statusLoading ? <StatsCardsSkeleton /> : <UptimeStatsCards />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section aria-label="Service Fleet Status" aria-busy={servicesLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Service Fleet Status</h2>
            {servicesLoading ? <SectionSkeleton rows={3} /> : <ComponentStatusGrid />}
          </section>

          <section aria-label="Detailed Services List" aria-busy={servicesLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Detailed Services List</h2>
            {servicesLoading ? <SectionSkeleton rows={5} /> : <ServiceHealthTable />}
          </section>

          <section className="bg-white p-4 border rounded-xl shadow-sm" aria-label="System Metrics" aria-busy={metricsLoading}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-bold text-gray-800">System Metrics</h2>
              {!metricsLoading && (
                <div className="flex flex-wrap items-center gap-3">
                  <MetricSelector />
                  <ChartControls />
                  <ChartExport />
                </div>
              )}
            </div>
            {metricsLoading ? <ChartSkeleton /> : <MetricsTimeSeries />}
          </section>

          <section aria-label="Service Topology" aria-busy={servicesLoading}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Service Topology &amp; Dependencies</h2>
            {servicesLoading ? <SectionSkeleton rows={4} /> : <DependencyGraph />}
          </section>
        </div>

        <div className="space-y-6">
          <section className="h-[350px]" aria-label="Active Alerts" aria-busy={alertsLoading}>
            {alertsLoading ? <SectionSkeleton rows={4} /> : <ActiveAlertsWidget />}
          </section>

          <section aria-label="Alerts List" aria-busy={alertsLoading}>
            {alertsLoading ? <SectionSkeleton rows={3} /> : <AlertsList />}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6" aria-busy={isLoading}>
            {isLoading ? (
              <>
                <SectionSkeleton rows={3} />
                <SectionSkeleton rows={3} />
              </>
            ) : (
              <>
                <SLATracker />
                <UptimeChart />
              </>
            )}
          </section>

          <section aria-busy={servicesLoading}>
            {servicesLoading ? <SectionSkeleton rows={3} /> : <HealthCheckConfigurator />}
          </section>

          <section className="h-[300px]" aria-busy={isLoading}>
            {isLoading ? <SectionSkeleton rows={4} /> : <DailyReportViewer />}
          </section>

          <section aria-busy={isLoading}>
            {isLoading ? <SectionSkeleton rows={3} /> : <MaintenanceCalendar />}
          </section>
        </div>
      </div>
    </div>
  );
}
