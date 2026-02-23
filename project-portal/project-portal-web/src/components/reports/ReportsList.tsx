'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import ReportSharing from './ReportSharing';
import { FileText, Play, Copy, Trash2, Loader2, Edit, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface ReportsListProps {
  onSelectReport?: (id: string) => void;
  onEditReport?: (id: string) => void;
  onScheduleReport?: (id: string) => void;
  category?: string;
  showTemplates?: boolean;
  showScheduleButton?: boolean;
}

export default function ReportsList({
  onSelectReport,
  onEditReport,
  onScheduleReport,
  category,
  showTemplates,
  showScheduleButton,
}: ReportsListProps) {
  const {
    reports,
    reportsLoading,
    fetchReports,
    cloneReport,
    deleteReport,
    updateReport,
  } = useReportsStore();

  useEffect(() => {
    fetchReports({
      category: category ?? undefined,
      is_template: showTemplates ?? false,
      page: 1,
      page_size: 50,
    });
  }, [fetchReports, category, showTemplates]);

  const handleClone = async (id: string, name: string) => {
    try {
      const cloned = await cloneReport(id, `${name} (copy)`);
      toast.success('Report cloned');
      onSelectReport?.(cloned.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clone failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this report?')) return;
    try {
      await deleteReport(id);
      toast.success('Report deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (reportsLoading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No reports yet. Create one with the Report Builder.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((report) => (
        <div
          key={report.id}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate">{report.name}</h3>
              {report.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{report.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span>{report.category ?? 'custom'}</span>
                <span>•</span>
                <span>v{report.version}</span>
              </div>
            </div>
            <ReportSharing
              report={report}
              onVisibilityChange={(v) => updateReport(report.id, { visibility: v }).catch(() => {})}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEditReport?.(report.id) ?? onSelectReport?.(report.id)}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onSelectReport?.(report.id)}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100"
            >
              <Play className="w-4 h-4 mr-1" />
              Run
            </button>
            {showScheduleButton && onScheduleReport && (
              <button
                type="button"
                onClick={() => onScheduleReport(report.id)}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100"
              >
                <Calendar className="w-4 h-4 mr-1" />
                Schedule
              </button>
            )}
            <button
              type="button"
              onClick={() => handleClone(report.id, report.name)}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <Copy className="w-4 h-4 mr-1" />
              Clone
            </button>
            <button
              type="button"
              onClick={() => handleDelete(report.id)}
              className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
