'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useReportsStore } from '@/store/store';
import type { ReportConfig, CreateReportRequest } from '@/store/reports.types';
import FieldSelector from './FieldSelector';
import FilterBuilder from './FilterBuilder';
import { Save, Play, Loader2 } from 'lucide-react';

const DEFAULT_CONFIG: ReportConfig = {
  dataset: '',
  fields: [],
  filters: [],
  groupings: [],
  sorts: [],
  limit: 1000,
};

interface ReportBuilderProps {
  reportId?: string | null;
  onSave?: (id: string) => void;
  onExecute?: (id: string) => void;
}

export default function ReportBuilder({ reportId, onSave, onExecute }: ReportBuilderProps) {
  const {
    datasets,
    datasetsLoading,
    fetchDatasets,
    currentReport,
    fetchReport,
    createReport,
    updateReport,
    executeReport,
    setCurrentReport,
    clearCurrentReport,
  } = useReportsStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  useEffect(() => {
    if (reportId) {
      fetchReport(reportId);
    } else {
      clearCurrentReport();
    }
  }, [reportId, fetchReport, clearCurrentReport]);

  useEffect(() => {
    if (currentReport) {
      setName(currentReport.name);
      setDescription(currentReport.description ?? '');
      setConfig(currentReport.config ?? DEFAULT_CONFIG);
    } else if (!reportId) {
      setName('');
      setDescription('');
      setConfig(DEFAULT_CONFIG);
    }
  }, [currentReport, reportId]);

  const currentDataset = config.dataset ? datasets.find((d) => d.name === config.dataset) : null;
  const fieldOptions = (currentDataset?.fields ?? []).map((f) => ({ name: f.name, display_name: f.display_name }));
  const availableFieldsForSelector = currentDataset?.fields ?? [];

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Report name is required');
      return;
    }
    if (!config.dataset || config.fields.length === 0) {
      toast.error('Select a dataset and at least one field');
      return;
    }
    setSaving(true);
    try {
      if (reportId && currentReport) {
        await updateReport(reportId, { name: name.trim(), description: description.trim() || undefined, config });
        toast.success('Report updated');
        onSave?.(reportId);
      } else {
        const body: CreateReportRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          config,
          category: 'custom',
          visibility: 'private',
        };
        const report = await createReport(body);
        setCurrentReport(report);
        toast.success('Report created');
        onSave?.(report.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    const id = reportId ?? currentReport?.id;
    if (!id) {
      toast.error('Save the report first before executing');
      return;
    }
    setExecuting(true);
    try {
      await executeReport(id, { format: 'csv' });
      toast.success('Report execution started');
      onExecute?.(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to execute report');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Report"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dataset</label>
          <select
            value={config.dataset}
            onChange={(e) => setConfig((c) => ({ ...c, dataset: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
            disabled={datasetsLoading}
          >
            <option value="">Select dataset</option>
            {datasets.map((d) => (
              <option key={d.name} value={d.name}>{d.display_name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
          placeholder="What this report shows..."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-gray-200 pt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <FieldSelector
            availableFields={availableFieldsForSelector}
            selectedFields={config.fields}
            onAdd={(f) => setConfig((c) => ({ ...c, fields: [...c.fields, f] }))}
            onRemove={(idx) => setConfig((c) => ({ ...c, fields: c.fields.filter((_, i) => i !== idx) }))}
            onUpdate={(idx, updates) =>
              setConfig((c) => ({
                ...c,
                fields: c.fields.map((f, i) => (i === idx ? { ...f, ...updates } : f)),
              }))
            }
            disabled={saving}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <FilterBuilder
            filters={config.filters ?? []}
            fieldOptions={fieldOptions}
            onChange={(filters) => setConfig((c) => ({ ...c, filters }))}
            disabled={saving}
          />
        </div>
      </div>

      {/* Live preview placeholder */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Preview</h4>
        <p className="text-sm text-gray-600">
          {config.fields.length === 0
            ? 'Add fields and save to run the report.'
            : `Fields: ${config.fields.map((f) => f.alias || f.name).join(', ')}. Filters: ${(config.filters?.length ?? 0)}.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={saving || datasetsLoading}
          className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {reportId ? 'Update' : 'Save'} report
        </button>
        <button
          onClick={handleExecute}
          disabled={executing || !(reportId ?? currentReport?.id)}
          className="inline-flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50"
        >
          {executing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
          Run now
        </button>
      </div>
    </div>
  );
}
