'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import type { ReportExecution } from '@/store/reports.types';
import { Loader2, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_ICONS: Record<ReportExecution['status'], typeof Clock> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

const STATUS_COLORS: Record<ReportExecution['status'], string> = {
  pending: 'text-gray-600 bg-gray-100',
  processing: 'text-cyan-600 bg-cyan-100',
  completed: 'text-emerald-600 bg-emerald-100',
  failed: 'text-red-600 bg-red-100',
};

interface ExecutionHistoryProps {
  reportId?: string | null;
  pageSize?: number;
}

export default function ExecutionHistory({ reportId, pageSize = 20 }: ExecutionHistoryProps) {
  const {
    executions,
    executionsLoading,
    executionsError,
    fetchExecutions,
    pollExecutionUntilDone,
  } = useReportsStore();

  useEffect(() => {
    fetchExecutions({ report_id: reportId ?? undefined, page: 1, page_size: pageSize });
  }, [fetchExecutions, reportId, pageSize]);

  const refreshStatus = async (executionId: string) => {
    try {
      const final = await pollExecutionUntilDone(executionId);
      if (final.status === 'completed') toast.success('Report ready');
      if (final.status === 'failed') toast.error(final.error_message ?? 'Execution failed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh status');
    }
  };

  if (executionsLoading && executions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (executionsError) {
    return (
      <div className="py-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
        {executionsError}
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No executions yet. Run a report to see history.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Triggered</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Records</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec) => {
            const Icon = STATUS_ICONS[exec.status];
            const color = STATUS_COLORS[exec.status];
            return (
              <tr key={exec.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${color}`}>
                    {exec.status === 'processing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {exec.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-700">
                  {new Date(exec.triggered_at).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-gray-700">{exec.record_count ?? '—'}</td>
                <td className="py-3 px-4">
                  {(exec.status === 'pending' || exec.status === 'processing') && (
                    <button
                      type="button"
                      onClick={() => refreshStatus(exec.id)}
                      className="text-cyan-600 hover:underline text-sm"
                    >
                      Refresh
                    </button>
                  )}
                  {exec.status === 'completed' && exec.download_url && (
                    <a
                      href={exec.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-emerald-600 hover:underline"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </a>
                  )}
                  {exec.status === 'failed' && exec.error_message && (
                    <span className="text-red-600 text-xs" title={exec.error_message}>
                      {exec.error_message.slice(0, 40)}…
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
