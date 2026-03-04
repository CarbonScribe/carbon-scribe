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

export default function SystemHealthDashboard() {
  const fetchDetailedStatus = useStore(state => state.fetchDetailedStatus);
  const fetchServices = useStore(state => state.fetchServices);
  const fetchAlerts = useStore(state => state.fetchAlerts);
  const fetchMetrics = useStore(state => state.fetchMetrics);
  const fetchDependencies = useStore(state => state.fetchDependencies);
  const fetchUptimeStats = useStore(state => state.fetchUptimeStats);
  const clearHealthData = useStore(state => state.clearHealthData);
  const isAuthenticated = useStore(state => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch initial data
      fetchDetailedStatus();
      fetchServices();
      fetchAlerts();
      fetchMetrics('1h');
      fetchDependencies();
      fetchUptimeStats();
    }

    return () => {
      // Clear data on unmount (or simulate logout clear)
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

      <SystemStatusBanner />
      <UptimeStatsCards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Service Fleet Status</h2>
            <ComponentStatusGrid />
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Detailed Services List</h2>
            <ServiceHealthTable />
          </section>

          <section className="bg-white p-4 border rounded-xl shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-bold text-gray-800">System Metrics</h2>
              <div className="flex flex-wrap items-center gap-3">
                <MetricSelector />
                <ChartControls />
                <ChartExport />
              </div>
            </div>
            <MetricsTimeSeries />
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">Service Topology & Dependencies</h2>
            <DependencyGraph />
          </section>
        </div>

        <div className="space-y-6">
          <section className="h-[350px]">
            <ActiveAlertsWidget />
          </section>

          <section>
            <AlertsList />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
            <SLATracker />
            <UptimeChart />
          </section>

          <section>
            <HealthCheckConfigurator />
          </section>

          <section className="h-[300px]">
            <DailyReportViewer />
          </section>

          <section>
            <MaintenanceCalendar />
          </section>
        </div>
      </div>
    </div>
  );
}