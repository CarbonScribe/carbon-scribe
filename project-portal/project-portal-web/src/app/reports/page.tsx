'use client';

import { useState } from 'react';
import {
  FileText,
  Wrench,
  History,
  Calendar,
  BarChart2,
  Database,
  LayoutDashboard,
  Plus,
} from 'lucide-react';
import ReportsList from '@/components/reports/ReportsList';
import ReportBuilder from '@/components/reports/ReportBuilder';
import ExecutionHistory from '@/components/reports/ExecutionHistory';
import DashboardGrid from '@/components/reports/DashboardGrid';
import WidgetLibrary from '@/components/reports/WidgetLibrary';
import WidgetConfigurator from '@/components/reports/WidgetConfigurator';
import ScheduleForm from '@/components/reports/ScheduleForm';
import BenchmarkComparison from '@/components/reports/BenchmarkComparison';
import DatasetExplorer from '@/components/reports/DatasetExplorer';
import { useReportsStore } from '@/store/store';
import type { WidgetType } from '@/store/reports.types';
import { toast } from 'sonner';

const TABS = [
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'builder', label: 'Report Builder', icon: Wrench },
  { id: 'executions', label: 'Execution History', icon: History },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schedules', label: 'Schedules', icon: Calendar },
  { id: 'benchmark', label: 'Benchmark', icon: BarChart2 },
  { id: 'datasets', label: 'Dataset Explorer', icon: Database },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ReportsPage() {
  const [tab, setTab] = useState<TabId>('reports');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [configuringWidget, setConfiguringWidget] = useState<Partial<import('@/store/reports.types').DashboardWidget> | null>(null);
  const [scheduleReportId, setScheduleReportId] = useState<string | null>(null);

  const { createWidget } = useReportsStore();

  const handleAddWidget = (type: WidgetType) => {
    setConfiguringWidget({
      widget_type: type,
      title: `New ${type}`,
      size: 'medium',
      position: 999,
      refresh_interval_seconds: 300,
      config: { data_source: 'dashboard_summary' },
    });
  };

  const handleSaveWidget = async (config: Partial<import('@/store/reports.types').DashboardWidget> & { config: import('@/store/reports.types').WidgetConfig }) => {
    try {
      await createWidget({
        widget_type: configuringWidget!.widget_type!,
        title: config.title ?? 'Widget',
        size: config.size ?? 'medium',
        position: configuringWidget!.position ?? 0,
        refresh_interval_seconds: config.refresh_interval_seconds ?? 300,
        config: config.config,
      });
      toast.success('Widget added');
      setConfiguringWidget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add widget');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-linear-to-r from-cyan-500 to-blue-600 rounded-2xl p-6 md:p-8 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-cyan-100">
          Create custom reports, run benchmarks, and manage your dashboard widgets.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                tab === t.id
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'reports' && (
        <ReportsList
          onSelectReport={setSelectedReportId}
          onEditReport={(id) => {
            setSelectedReportId(id);
            setTab('builder');
          }}
        />
      )}

      {tab === 'builder' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <ReportBuilder
            reportId={selectedReportId}
            onSave={(id) => setSelectedReportId(id)}
            onExecute={() => setTab('executions')}
          />
        </div>
      )}

      {tab === 'executions' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <ExecutionHistory reportId={selectedReportId} />
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Widgets</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Add:</span>
              <WidgetLibrary onSelect={handleAddWidget} />
            </div>
          </div>
          {configuringWidget && (
            <WidgetConfigurator
              widget={configuringWidget}
              onSave={handleSaveWidget}
              onCancel={() => setConfiguringWidget(null)}
            />
          )}
          <DashboardGrid />
        </div>
      )}

      {tab === 'schedules' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {scheduleReportId ? (
            <div className="space-y-4">
              <button
                onClick={() => setScheduleReportId(null)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to report list
              </button>
              <ScheduleForm
                reportId={scheduleReportId}
                onSuccess={() => setScheduleReportId(null)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">Choose a report to schedule delivery (email, S3, or webhook):</p>
              <ReportsList
                onScheduleReport={(id) => setScheduleReportId(id)}
                showScheduleButton
              />
            </div>
          )}
        </div>
      )}

      {tab === 'benchmark' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <BenchmarkComparison />
        </div>
      )}

      {tab === 'datasets' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <DatasetExplorer />
        </div>
      )}
    </div>
  );
}
