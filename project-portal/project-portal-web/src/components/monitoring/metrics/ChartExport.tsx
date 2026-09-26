'use client';

import React, { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showErrorToast, showSuccessToast } from '@/lib/utils/toast';
import { serializeMetricsToCsv } from './exportUtils';

interface ChartExportProps {
  chartRef?: React.RefObject<HTMLElement | null>;
}

export default function ChartExport({ chartRef }: ChartExportProps) {
  const metrics = useStore((state) => state.metrics);
  const [isExporting, setIsExporting] = useState(false);

  const exportFileName = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    return `metrics-export-${date}.csv`;
  }, []);

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const csv = serializeMetricsToCsv(metrics ?? []);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = exportFileName;
      link.click();
      URL.revokeObjectURL(href);
      showSuccessToast('Metrics CSV downloaded');
    } catch (error) {
      console.error('Failed to export metrics CSV', error);
      showErrorToast('Failed to export metrics CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={handleExport}
      disabled={isExporting || !metrics?.length}
      aria-busy={isExporting}
    >
      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
    </button>
  );
}
