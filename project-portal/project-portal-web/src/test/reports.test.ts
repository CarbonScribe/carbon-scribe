// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiListReports,
  apiGetReport,
  apiCreateReport,
  apiUpdateReport,
  apiDeleteReport,
  apiCloneReport,
  apiListTemplates,
  apiExecuteReport,
  apiExportReport,
  apiListExecutions,
  apiGetExecution,
  apiCancelExecution,
  apiGetDatasets,
  apiGetDashboardSummary,
  apiGetTimeSeriesData,
  apiGetWidgets,
  apiCreateWidget,
  apiUpdateWidget,
  apiDeleteWidget,
  apiCreateSchedule,
  apiListSchedules,
  apiGetSchedule,
  apiUpdateSchedule,
  apiDeleteSchedule,
  apiToggleSchedule,
  apiBenchmarkComparison,
  apiListBenchmarks,
} from '@/store/reports.api';
import api from '@/lib/api/apiClient';

vi.mock('@/lib/api/apiClient', () => ({
  default: {
    request: vi.fn(),
  },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  vi.mocked(api.request).mockResolvedValue({
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    data: body,
    headers: {},
    config: {},
  });
}

function mockFetchError(message: string, status = 400) {
  const error = new Error('Request failed');
  (error as any).response = {
    status,
    statusText: 'Bad Request',
    data: { error: message },
    headers: {},
    config: {},
  };
  (error as any).isAxiosError = true;
  vi.mocked(api.request).mockRejectedValue(error);
}

function mockFetchRawError(status: number, statusText: string, data: string) {
  const error = new Error('Request failed');
  (error as any).response = {
    status,
    statusText,
    data,
    headers: {},
    config: {},
  };
  (error as any).isAxiosError = true;
  vi.mocked(api.request).mockRejectedValue(error);
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const REPORT = {
  id: 'r-1',
  name: 'Test Report',
  description: 'desc',
  category: 'custom' as const,
  config: { dataset: 'projects', fields: [{ name: 'id' }] },
  visibility: 'private' as const,
  version: 1,
  is_template: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const EXECUTION = {
  id: 'e-1',
  report_definition_id: 'r-1',
  triggered_at: '2024-01-01T00:00:00Z',
  status: 'completed' as const,
  created_at: '2024-01-01T00:00:00Z',
};

const SCHEDULE = {
  id: 's-1',
  report_definition_id: 'r-1',
  name: 'Daily',
  cron_expression: '0 8 * * *',
  timezone: 'UTC',
  is_active: true,
  format: 'csv' as const,
  delivery_method: 'email' as const,
  delivery_config: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const WIDGET = {
  id: 'w-1',
  widget_type: 'metric' as const,
  title: 'Credits',
  config: { data_source: 'dashboard_summary' },
  size: 'medium' as const,
  position: 0,
  refresh_interval_seconds: 300,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const SUMMARY = {
  total_projects: 5,
  total_credits: 1000,
  total_revenue: 10000,
  active_monitoring_areas: 3,
  recent_activity: [],
  performance_metrics: {},
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('Reports API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Report CRUD ──────────────────────────────────────────────────────────

  describe('apiListReports', () => {
    it('returns reports list', async () => {
      const payload = { reports: [REPORT], total: 1, page: 1, page_size: 20, total_pages: 1 };
      mockFetch(payload);
      const result = await apiListReports({ page: 1, page_size: 20 });
      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('reports?');
    });

    it('passes filter params in query string', async () => {
      mockFetch({ reports: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
      await apiListReports({ category: 'financial', is_template: true, search: 'foo' });
      const config = vi.mocked(api.request).mock.calls[0][0];
      const url = config.url as string;
      expect(url).toContain('category=financial');
      expect(url).toContain('is_template=true');
      expect(url).toContain('search=foo');
    });

    it('throws on API error', async () => {
      mockFetchError('unauthorized', 401);
      await expect(apiListReports()).rejects.toThrow('unauthorized');
    });
  });

  describe('apiGetReport', () => {
    it('returns a single report', async () => {
      mockFetch(REPORT);
      const result = await apiGetReport('r-1');
      expect(result.id).toBe('r-1');
    });
  });

  describe('apiCreateReport', () => {
    it('posts to /builder and returns created report', async () => {
      mockFetch(REPORT, 201);
      const result = await apiCreateReport({
        name: 'Test Report',
        config: { dataset: 'projects', fields: [{ name: 'id' }] },
      });
      expect(result.id).toBe('r-1');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('builder');
      expect(config.method).toBe('POST');
    });
  });

  describe('apiUpdateReport', () => {
    it('puts to /:id and returns updated report', async () => {
      mockFetch({ ...REPORT, name: 'Updated' });
      const result = await apiUpdateReport('r-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.method).toBe('PUT');
    });
  });

  describe('apiDeleteReport', () => {
    it('sends DELETE and resolves on 204', async () => {
      mockFetch(null, 204);
      await expect(apiDeleteReport('r-1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      mockFetchError('not found', 404);
      await expect(apiDeleteReport('r-1')).rejects.toThrow('not found');
    });
  });

  describe('apiCloneReport', () => {
    it('posts to /:id/clone', async () => {
      mockFetch({ ...REPORT, id: 'r-2', name: 'Copy' }, 201);
      const result = await apiCloneReport('r-1', 'Copy');
      expect(result.id).toBe('r-2');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('r-1/clone');
    });
  });

  // ── Templates ────────────────────────────────────────────────────────────

  describe('apiListTemplates', () => {
    it('returns templates array', async () => {
      mockFetch({ templates: [{ ...REPORT, is_template: true }] });
      const result = await apiListTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].is_template).toBe(true);
    });

    it('returns empty array when templates key missing', async () => {
      mockFetch({});
      const result = await apiListTemplates();
      expect(result).toEqual([]);
    });
  });

  // ── Execution ────────────────────────────────────────────────────────────

  describe('apiExecuteReport', () => {
    it('posts to /:id/execute', async () => {
      mockFetch(EXECUTION, 202);
      const result = await apiExecuteReport('r-1', { format: 'csv' });
      expect(result.id).toBe('e-1');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('r-1/execute');
      expect(config.method).toBe('POST');
    });
  });

  describe('apiExportReport', () => {
    it('returns execution_id for async export', async () => {
      mockFetch({ execution_id: 'e-1', status: 'pending' }, 202);
      const result = await apiExportReport('r-1', 'pdf');
      expect(result.execution_id).toBe('e-1');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('format=pdf');
    });
  });

  describe('apiListExecutions', () => {
    it('returns executions list', async () => {
      mockFetch({ executions: [EXECUTION], total: 1, page: 1, page_size: 20, total_pages: 1 });
      const result = await apiListExecutions({ report_id: 'r-1' });
      expect(result.executions).toHaveLength(1);
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('report_id=r-1');
    });
  });

  describe('apiGetExecution', () => {
    it('returns a single execution', async () => {
      mockFetch(EXECUTION);
      const result = await apiGetExecution('e-1');
      expect(result.id).toBe('e-1');
    });
  });

  describe('apiCancelExecution', () => {
    it('posts to /cancel', async () => {
      mockFetch({ message: 'cancelled' });
      await expect(apiCancelExecution('e-1')).resolves.toBeUndefined();
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('e-1/cancel');
    });
  });

  // ── Datasets ─────────────────────────────────────────────────────────────

  describe('apiGetDatasets', () => {
    it('returns datasets array', async () => {
      const ds = { name: 'projects', display_name: 'Projects', description: '', fields: [] };
      mockFetch({ datasets: [ds] });
      const result = await apiGetDatasets();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('projects');
    });
  });

  // ── Dashboard ────────────────────────────────────────────────────────────

  describe('apiGetDashboardSummary', () => {
    it('returns summary object', async () => {
      mockFetch(SUMMARY);
      const result = await apiGetDashboardSummary();
      expect(result.total_projects).toBe(5);
      expect(result.total_credits).toBe(1000);
    });
  });

  describe('apiGetTimeSeriesData', () => {
    it('passes required params and returns data', async () => {
      const points = [{ time: '2024-01-01T00:00:00Z', value: 42 }];
      mockFetch({ data: points });
      const result = await apiGetTimeSeriesData({
        metric: 'carbon_sequestered',
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-12-31T00:00:00Z',
        interval: 'month',
      });
      expect(result.data).toHaveLength(1);
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('metric=carbon_sequestered');
      expect(config.url).toContain('interval=month');
    });
  });

  // ── Widgets ──────────────────────────────────────────────────────────────

  describe('apiGetWidgets', () => {
    it('returns widgets array', async () => {
      mockFetch({ widgets: [WIDGET] });
      const result = await apiGetWidgets();
      expect(result).toHaveLength(1);
    });

    it('passes section param', async () => {
      mockFetch({ widgets: [] });
      await apiGetWidgets('main');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('section=main');
    });
  });

  describe('apiCreateWidget', () => {
    it('posts widget and returns created', async () => {
      mockFetch(WIDGET, 201);
      const { id, created_at, updated_at, ...body } = WIDGET;
      const result = await apiCreateWidget(body);
      expect(result.id).toBe('w-1');
    });
  });

  describe('apiUpdateWidget', () => {
    it('puts to /:widgetId', async () => {
      mockFetch({ ...WIDGET, title: 'Updated' });
      const result = await apiUpdateWidget('w-1', { ...WIDGET, config: WIDGET.config });
      expect(result.title).toBe('Updated');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('w-1');
      expect(config.method).toBe('PUT');
    });
  });

  describe('apiDeleteWidget', () => {
    it('sends DELETE', async () => {
      mockFetch(null, 204);
      await expect(apiDeleteWidget('w-1')).resolves.toBeUndefined();
    });
  });

  // ── Schedules ────────────────────────────────────────────────────────────

  describe('apiCreateSchedule', () => {
    it('posts to /schedules', async () => {
      mockFetch(SCHEDULE, 201);
      const result = await apiCreateSchedule({
        report_definition_id: 'r-1',
        name: 'Daily',
        cron_expression: '0 8 * * *',
        format: 'csv',
        delivery_method: 'email',
        delivery_config: {},
      });
      expect(result.id).toBe('s-1');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('schedules');
      expect(config.method).toBe('POST');
    });
  });

  describe('apiListSchedules', () => {
    it('returns schedules and total', async () => {
      mockFetch({ schedules: [SCHEDULE], total: 1 });
      const result = await apiListSchedules({ is_active: true });
      expect(result.schedules).toHaveLength(1);
      expect(result.total).toBe(1);
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('is_active=true');
    });
  });

  describe('apiGetSchedule', () => {
    it('returns a single schedule', async () => {
      mockFetch(SCHEDULE);
      const result = await apiGetSchedule('s-1');
      expect(result.id).toBe('s-1');
    });
  });

  describe('apiUpdateSchedule', () => {
    it('puts to /:scheduleId', async () => {
      mockFetch({ ...SCHEDULE, name: 'Weekly' });
      const result = await apiUpdateSchedule('s-1', {
        report_definition_id: 'r-1',
        name: 'Weekly',
        cron_expression: '0 9 * * 1',
        format: 'csv',
        delivery_method: 'email',
        delivery_config: {},
      });
      expect(result.name).toBe('Weekly');
    });
  });

  describe('apiDeleteSchedule', () => {
    it('sends DELETE', async () => {
      mockFetch(null, 204);
      await expect(apiDeleteSchedule('s-1')).resolves.toBeUndefined();
    });
  });

  describe('apiToggleSchedule', () => {
    it('posts to /:scheduleId/toggle', async () => {
      mockFetch({ message: 'schedule updated', active: false });
      const result = await apiToggleSchedule('s-1', false);
      expect(result.active).toBe(false);
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('s-1/toggle');
      expect(config.method).toBe('POST');
      expect(config.data).toEqual({ active: false });
    });
  });

  // ── Benchmarks ───────────────────────────────────────────────────────────

  describe('apiBenchmarkComparison', () => {
    it('posts to /benchmark/comparison', async () => {
      const response = {
        project_id: 'p-1',
        project_metrics: {},
        benchmarks: [],
        percentile_rank: {},
        gap_analysis: [],
      };
      mockFetch(response);
      const result = await apiBenchmarkComparison({ project_id: 'p-1', category: 'carbon' });
      expect(result.project_id).toBe('p-1');
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('benchmark/comparison');
    });
  });

  describe('apiListBenchmarks', () => {
    it('returns benchmarks array', async () => {
      const bm = { id: 'b-1', name: 'BM', category: 'carbon', data: {}, year: 2024, is_active: true, created_at: '', updated_at: '' };
      mockFetch({ benchmarks: [bm] });
      const result = await apiListBenchmarks({ category: 'carbon' });
      expect(result).toHaveLength(1);
      const config = vi.mocked(api.request).mock.calls[0][0];
      expect(config.url).toContain('category=carbon');
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws with error message from JSON body', async () => {
      mockFetchError('report not found', 404);
      await expect(apiGetReport('bad-id')).rejects.toThrow('report not found');
    });

    it('throws with statusText when body is not JSON', async () => {
      mockFetchRawError(500, 'Internal Server Error', '');
      await expect(apiGetReport('r-1')).rejects.toThrow('Internal Server Error');
    });

    it('does not expose HTML error pages as error message', async () => {
      mockFetchRawError(502, 'Bad Gateway', '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>');
      await expect(apiGetReport('r-1')).rejects.toThrow('Bad Gateway');
    });
  });
});
