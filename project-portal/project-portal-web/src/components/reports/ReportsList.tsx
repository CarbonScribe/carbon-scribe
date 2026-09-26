"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@/lib/store/store";
import ReportSharing from "./ReportSharing";
import {
  FileText,
  Play,
  Copy,
  Trash2,
  Loader2,
  Edit,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/ui/EmptyState";

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
    reportsError,
    reportsQuery,
    fetchReports,
    cloneReport,
    deleteReport,
    updateReport,
  } = useStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshReports = useCallback(
    async (overrideParams?: {
      category?: string;
      is_template?: boolean;
      page?: number;
      page_size?: number;
    }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      await fetchReports(
        {
          category: overrideParams?.category ?? category ?? undefined,
          is_template: overrideParams?.is_template ?? showTemplates ?? false,
          page: overrideParams?.page ?? 1,
          page_size: overrideParams?.page_size ?? 50,
        },
        { signal: controller.signal },
      );
    },
    [category, fetchReports, showTemplates],
  );

  useEffect(() => {
    refreshReports().catch((error) => {
      console.debug("[ReportsList] fetchReports failed on mount:", error);
    });

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [refreshReports]);

  const handleClone = async (id: string, name: string) => {
    try {
      const cloned = await cloneReport(id, `${name} (copy)`);
      toast.success("Report cloned");
      onSelectReport?.(cloned.id);
      await refreshReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clone failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this report?"))
      return;
    try {
      await deleteReport(id);
      toast.success("Report deleted");
      await refreshReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const isRefreshing = reportsLoading && reports.length > 0;

  if (reportsLoading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (reportsError && reports.length === 0) {
    return (
      <div className="space-y-6 p-6 rounded-2xl border border-red-100 bg-red-50">
        <div className="flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-semibold">Unable to load reports</h2>
            <p className="text-sm text-red-600">{reportsError}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => refreshReports().catch(() => {})}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="No reports yet"
          description="Create your first report using the Report Builder."
        />
        {reportsError && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {reportsError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm text-gray-500">Reports</p>
          <p className="text-xs text-gray-400">{reports.length} report(s) found</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRefreshing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing
            </span>
          )}
          <button
            type="button"
            onClick={() => refreshReports().catch(() => {})}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {report.name}
                </h3>
                {report.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {report.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span>{report.category ?? "custom"}</span>
                  <span>•</span>
                  <span>v{report.version}</span>
                </div>
              </div>
              <ReportSharing
                report={report}
                onVisibilityChange={(v) =>
                  updateReport(report.id, { visibility: v }).catch(() => {})
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  onEditReport?.(report.id) ?? onSelectReport?.(report.id)
                }
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
    </div>
  );
}
