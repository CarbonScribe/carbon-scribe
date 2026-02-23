import { getReportsApiBase } from '@/lib/api';
import type {
  CreateReportRequest,
  UpdateReportRequest,
  ExecuteReportRequest,
  CreateScheduleRequest,
  BenchmarkComparisonRequest,
  ReportDefinition,
  ReportExecution,
  ReportSchedule,
  DashboardWidget,
  DashboardSummary,
  ListReportsResponse,
  ListExecutionsResponse,
  BenchmarkComparisonResponse,
  DatasetMetadata,
  BenchmarkDataset,
  WidgetConfig,
} from './reports.types';
import type { ApiError } from '@/lib/api';

const base = () => getReportsApiBase();
const reportsPath = () => `${base()}/reports`;

function defaultHeaders(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const j = JSON.parse(text) as ApiError;
      if (j.error) message = j.error;
    } catch {
      // Avoid storing HTML error pages as the error message
      if (text && !text.trim().startsWith('<!') && !text.trim().startsWith('<html')) {
        message = text.length > 200 ? text.slice(0, 200) + '...' : text;
      }
    }
    throw new Error(message);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiCreateReport(body: CreateReportRequest): Promise<ReportDefinition> {
  const res = await fetch(`${reportsPath()}/builder`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<ReportDefinition>(res);
}

export async function apiListReports(params?: {
  category?: string;
  visibility?: string;
  is_template?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<ListReportsResponse> {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.visibility) q.set('visibility', params.visibility);
  if (params?.is_template !== undefined) q.set('is_template', String(params.is_template));
  if (params?.search) q.set('search', params.search);
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const url = `${reportsPath()}?${q.toString()}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<ListReportsResponse>(res);
}

export async function apiGetReport(id: string): Promise<ReportDefinition> {
  const res = await fetch(`${reportsPath()}/${id}`, { headers: defaultHeaders() });
  return handleResponse<ReportDefinition>(res);
}

export async function apiUpdateReport(id: string, body: UpdateReportRequest): Promise<ReportDefinition> {
  const res = await fetch(`${reportsPath()}/${id}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<ReportDefinition>(res);
}

export async function apiDeleteReport(id: string): Promise<void> {
  const res = await fetch(`${reportsPath()}/${id}`, { method: 'DELETE' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

export async function apiCloneReport(id: string, name: string): Promise<ReportDefinition> {
  const res = await fetch(`${reportsPath()}/${id}/clone`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ name }),
  });
  return handleResponse<ReportDefinition>(res);
}

export async function apiListTemplates(): Promise<ReportDefinition[]> {
  const res = await fetch(`${reportsPath()}/templates`, { headers: defaultHeaders() });
  const data = await handleResponse<{ templates: ReportDefinition[] }>(res);
  return data.templates ?? [];
}

export async function apiExecuteReport(id: string, body?: ExecuteReportRequest): Promise<ReportExecution> {
  const res = await fetch(`${reportsPath()}/${id}/execute`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<ReportExecution>(res);
}

export async function apiExportReport(id: string, format: string = 'csv'): Promise<{ execution_id: string; status: string }> {
  const res = await fetch(`${reportsPath()}/${id}/export?format=${format}`, { method: 'GET' });
  return handleResponse<{ execution_id: string; status: string }>(res);
}

export async function apiListExecutions(params?: {
  report_id?: string;
  schedule_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<ListExecutionsResponse> {
  const q = new URLSearchParams();
  if (params?.report_id) q.set('report_id', params.report_id);
  if (params?.schedule_id) q.set('schedule_id', params.schedule_id);
  if (params?.status) q.set('status', params.status);
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const res = await fetch(`${reportsPath()}/executions?${q.toString()}`, { headers: defaultHeaders() });
  return handleResponse<ListExecutionsResponse>(res);
}

export async function apiGetExecution(executionId: string): Promise<ReportExecution> {
  const res = await fetch(`${reportsPath()}/executions/${executionId}`, { headers: defaultHeaders() });
  return handleResponse<ReportExecution>(res);
}

export async function apiCancelExecution(executionId: string): Promise<void> {
  const res = await fetch(`${reportsPath()}/executions/${executionId}/cancel`, { method: 'POST' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

export async function apiGetDatasets(): Promise<DatasetMetadata[]> {
  const res = await fetch(`${reportsPath()}/datasets`, { headers: defaultHeaders() });
  const data = await handleResponse<{ datasets: DatasetMetadata[] }>(res);
  return data.datasets ?? [];
}

export async function apiGetDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${reportsPath()}/dashboard/summary`, { headers: defaultHeaders() });
  return handleResponse<DashboardSummary>(res);
}

export async function apiGetTimeSeriesData(params: {
  metric: string;
  start_time: string;
  end_time: string;
  interval?: string;
}): Promise<{ data: Array<{ time: string; value: number; label?: string }> }> {
  const q = new URLSearchParams({
    metric: params.metric,
    start_time: params.start_time,
    end_time: params.end_time,
    ...(params.interval && { interval: params.interval }),
  });
  const res = await fetch(`${reportsPath()}/dashboard/timeseries?${q.toString()}`, { headers: defaultHeaders() });
  return handleResponse<{ data: Array<{ time: string; value: number; label?: string }> }>(res);
}

export async function apiGetWidgets(section?: string): Promise<DashboardWidget[]> {
  const url = section ? `${reportsPath()}/dashboard/widgets?section=${encodeURIComponent(section)}` : `${reportsPath()}/dashboard/widgets`;
  const res = await fetch(url, { headers: defaultHeaders() });
  const data = await handleResponse<{ widgets: DashboardWidget[] }>(res);
  return data.widgets ?? [];
}

export async function apiCreateWidget(widget: Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'>): Promise<DashboardWidget> {
  const res = await fetch(`${reportsPath()}/dashboard/widgets`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(widget),
  });
  return handleResponse<DashboardWidget>(res);
}

export async function apiUpdateWidget(widgetId: string, widget: Partial<DashboardWidget> & { config: WidgetConfig }): Promise<DashboardWidget> {
  const res = await fetch(`${reportsPath()}/dashboard/widgets/${widgetId}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify({ ...widget, id: widgetId }),
  });
  return handleResponse<DashboardWidget>(res);
}

export async function apiDeleteWidget(widgetId: string): Promise<void> {
  const res = await fetch(`${reportsPath()}/dashboard/widgets/${widgetId}`, { method: 'DELETE' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

export async function apiCreateSchedule(body: CreateScheduleRequest): Promise<ReportSchedule> {
  const res = await fetch(`${reportsPath()}/schedules`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<ReportSchedule>(res);
}

export async function apiListSchedules(params?: {
  report_id?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<{ schedules: ReportSchedule[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.report_id) q.set('report_id', params.report_id);
  if (params?.is_active !== undefined) q.set('is_active', String(params.is_active));
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const res = await fetch(`${reportsPath()}/schedules?${q.toString()}`, { headers: defaultHeaders() });
  return handleResponse<{ schedules: ReportSchedule[]; total: number }>(res);
}

export async function apiGetSchedule(scheduleId: string): Promise<ReportSchedule> {
  const res = await fetch(`${reportsPath()}/schedules/${scheduleId}`, { headers: defaultHeaders() });
  return handleResponse<ReportSchedule>(res);
}

export async function apiUpdateSchedule(scheduleId: string, body: CreateScheduleRequest): Promise<ReportSchedule> {
  const res = await fetch(`${reportsPath()}/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<ReportSchedule>(res);
}

export async function apiDeleteSchedule(scheduleId: string): Promise<void> {
  const res = await fetch(`${reportsPath()}/schedules/${scheduleId}`, { method: 'DELETE' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

export async function apiToggleSchedule(scheduleId: string, active: boolean): Promise<{ message: string; active: boolean }> {
  const res = await fetch(`${reportsPath()}/schedules/${scheduleId}/toggle`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ active }),
  });
  return handleResponse<{ message: string; active: boolean }>(res);
}

export async function apiBenchmarkComparison(body: BenchmarkComparisonRequest): Promise<BenchmarkComparisonResponse> {
  const res = await fetch(`${reportsPath()}/benchmark/comparison`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<BenchmarkComparisonResponse>(res);
}

export async function apiListBenchmarks(params?: {
  category?: string;
  methodology?: string;
  region?: string;
  year?: number;
}): Promise<BenchmarkDataset[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.methodology) q.set('methodology', params.methodology);
  if (params?.region) q.set('region', params.region);
  if (params?.year !== undefined) q.set('year', String(params.year));
  const res = await fetch(`${reportsPath()}/benchmarks?${q.toString()}`, { headers: defaultHeaders() });
  const data = await handleResponse<{ benchmarks: BenchmarkDataset[] }>(res);
  return data.benchmarks ?? [];
}
