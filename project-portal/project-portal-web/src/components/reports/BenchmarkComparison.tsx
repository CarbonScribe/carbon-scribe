'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useReportsStore } from '@/store/store';
import { useFarmer } from '@/contexts/FarmerContext';
import { TrendingUp, TrendingDown, Minus, Loader2, BarChart2 } from 'lucide-react';

export default function BenchmarkComparison() {
  const { projects } = useFarmer();
  const {
    benchmarkResult,
    benchmarkLoading,
    benchmarkError,
    fetchBenchmarkComparison,
    clearBenchmark,
  } = useReportsStore();
  const [projectId, setProjectId] = useState(projects[0]?.id?.toString() ?? '');
  const [category, setCategory] = useState('carbon');
  const [year, setYear] = useState(new Date().getFullYear());

  const runComparison = async () => {
    const pid = projectId || projects[0]?.id;
    if (!pid) {
      toast.error('Select a project');
      return;
    }
    try {
      await fetchBenchmarkComparison({
        project_id: String(pid),
        category,
        year,
      });
      toast.success('Benchmark comparison complete');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Comparison failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 p-4 bg-white rounded-xl border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 min-w-[200px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="carbon">Carbon</option>
            <option value="financial">Financial</option>
            <option value="operational">Operational</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 w-24"
          />
        </div>
        <button
          type="button"
          onClick={runComparison}
          disabled={benchmarkLoading}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center"
        >
          {benchmarkLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <BarChart2 className="w-5 h-5 mr-2" />}
          Compare
        </button>
        {benchmarkResult && (
          <button
            type="button"
            onClick={clearBenchmark}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {benchmarkError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          {benchmarkError}
        </div>
      )}

      {benchmarkResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Percentile rankings</h3>
            <div className="space-y-3">
              {Object.entries(benchmarkResult.percentile_rank ?? {}).map(([metric, pct]) => (
                <div key={metric} className="flex items-center justify-between">
                  <span className="text-gray-700 capitalize">{metric.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-medium text-gray-900">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Gap analysis</h3>
            <div className="space-y-3">
              {benchmarkResult.gap_analysis?.map((gap) => (
                <div
                  key={gap.metric}
                  className={`p-3 rounded-lg border ${
                    gap.priority === 'high' ? 'border-amber-200 bg-amber-50' :
                    gap.priority === 'medium' ? 'border-cyan-200 bg-cyan-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{gap.metric}</div>
                  <div className="text-sm text-gray-600 mt-1">{gap.recommendation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Benchmark results</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Metric</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Your value</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Benchmark</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Difference</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkResult.benchmarks?.map((b) => (
                    <tr key={b.metric} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium">{b.metric}</td>
                      <td className="py-2 px-3">{b.project_value}</td>
                      <td className="py-2 px-3">{b.benchmark_value}</td>
                      <td className="py-2 px-3">
                        {b.difference >= 0 ? '+' : ''}{b.difference} ({b.difference_percent >= 0 ? '+' : ''}{b.difference_percent.toFixed(1)}%)
                      </td>
                      <td className="py-2 px-3">
                        {b.performance_level === 'above' && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                        {b.performance_level === 'below' && <TrendingDown className="w-4 h-4 text-red-600" />}
                        {b.performance_level === 'at' && <Minus className="w-4 h-4 text-gray-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
