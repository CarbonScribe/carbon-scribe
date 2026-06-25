import { getReportsApiBase } from '@/lib/api';
import api from '@/lib/api/apiClient';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
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

async function reportsRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await api.request<T>({
      ...config,
      baseURL: getReportsApiBase(),
    });
    return response.data;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const res = err.response;
      if (res) {
        let message = res.statusText || `Request failed (${res.status})`;
        const data = res.data;
        if (data) {
          if (typeof data === 'object') {
            const errData = data as any;
            if (errData.error) {
              message = errData.error;
            } else if (errData.message) {
              message = errData.message;
            }
          } else if (typeof data === 'string') {
            const text = data.trim();
            if (text && !text.startsWith('<!') && !text.startsWith('<html')) {
              message = text.length > 200 ? text.slice(0, 200) + '...' : text;
            }
          }
        }
        throw new Error(message);
      }
    }
    throw err;
  }
}

export async function apiCreateReport(body: CreateReportRequest): Promise<ReportDefinition> {
  return reportsRequest<ReportDefinition>({
    method: 'POST',
    url: 'reports/builder',
    data: body,
  });
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
  return reportsRequest<ListReportsResponse>({
    method: 'GET',
    url: `reports?${q.toString()}`,
  });
}

export async function apiGetReport(id: string): Promise<ReportDefinition> {
  return reportsRequest<ReportDefinition>({
    method: 'GET',
    url: `reports/${id}`,
  });
}

export async function apiUpdateReport(id: string, body: UpdateReportRequest): Promise<ReportDefinition> {
  return reportsRequest<ReportDefinition>({
    method: 'PUT',
    url: `reports/${id}`,
    data: body,
  });
}

export async function apiDeleteReport(id: string): Promise<void> {
  await reportsRequest<void>({
    method: 'DELETE',
    url: `reports/${id}`,
  });
}

export async function apiCloneReport(id: string, name: string): Promise<ReportDefinition> {
  return reportsRequest<ReportDefinition>({
    method: 'POST',
    url: `reports/${id}/clone`,
    data: { name },
  });
}

export async function apiListTemplates(): Promise<ReportDefinition[]> {
  const data = await reportsRequest<{ templates: ReportDefinition[] }>({
    method: 'GET',
    url: 'reports/templates',
  });
  return data?.templates ?? [];
}

export async function apiExecuteReport(id: string, body?: ExecuteReportRequest): Promise<ReportExecution> {
  return reportsRequest<ReportExecution>({
    method: 'POST',
    url: `reports/${id}/execute`,
    data: body,
  });
}

export async function apiExportReport(id: string, format: string = 'csv'): Promise<{ execution_id: string; status: string }> {
  return reportsRequest<{ execution_id: string; status: string }>({
    method: 'GET',
    url: `reports/${id}/export?format=${format}`,
  });
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
  return reportsRequest<ListExecutionsResponse>({
    method: 'GET',
    url: `reports/executions?${q.toString()}`,
  });
}

export async function apiGetExecution(executionId: string): Promise<ReportExecution> {
  return reportsRequest<ReportExecution>({
    method: 'GET',
    url: `reports/executions/${executionId}`,
  });
}

export async function apiCancelExecution(executionId: string): Promise<void> {
  await reportsRequest<void>({
    method: 'POST',
    url: `reports/executions/${executionId}/cancel`,
  });
}

export async function apiGetDatasets(): Promise<DatasetMetadata[]> {
  const data = await reportsRequest<{ datasets: DatasetMetadata[] }>({
    method: 'GET',
    url: 'reports/datasets',
  });
  return data?.datasets ?? [];
}

export async function apiGetDashboardSummary(): Promise<DashboardSummary> {
  return reportsRequest<DashboardSummary>({
    method: 'GET',
    url: 'reports/dashboard/summary',
  });
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
  return reportsRequest<{ data: Array<{ time: string; value: number; label?: string }> }>({
    method: 'GET',
    url: `reports/dashboard/timeseries?${q.toString()}`,
  });
}

export async function apiGetWidgets(section?: string): Promise<DashboardWidget[]> {
  const url = section ? `reports/dashboard/widgets?section=${encodeURIComponent(section)}` : 'reports/dashboard/widgets';
  const data = await reportsRequest<{ widgets: DashboardWidget[] }>({
    method: 'GET',
    url,
  });
  return data?.widgets ?? [];
}

export async function apiCreateWidget(widget: Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'>): Promise<DashboardWidget> {
  return reportsRequest<DashboardWidget>({
    method: 'POST',
    url: 'reports/dashboard/widgets',
    data: widget,
  });
}

export async function apiUpdateWidget(widgetId: string, widget: Partial<DashboardWidget> & { config: WidgetConfig }): Promise<DashboardWidget> {
  return reportsRequest<DashboardWidget>({
    method: 'PUT',
    url: `reports/dashboard/widgets/${widgetId}`,
    data: { ...widget, id: widgetId },
  });
}

export async function apiDeleteWidget(widgetId: string): Promise<void> {
  await reportsRequest<void>({
    method: 'DELETE',
    url: `reports/dashboard/widgets/${widgetId}`,
  });
}

export async function apiCreateSchedule(body: CreateScheduleRequest): Promise<ReportSchedule> {
  return reportsRequest<ReportSchedule>({
    method: 'POST',
    url: 'reports/schedules',
    data: body,
  });
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
  return reportsRequest<{ schedules: ReportSchedule[]; total: number }>({
    method: 'GET',
    url: `reports/schedules?${q.toString()}`,
  });
}

export async function apiGetSchedule(scheduleId: string): Promise<ReportSchedule> {
  return reportsRequest<ReportSchedule>({
    method: 'GET',
    url: `reports/schedules/${scheduleId}`,
  });
}

export async function apiUpdateSchedule(scheduleId: string, body: CreateScheduleRequest): Promise<ReportSchedule> {
  return reportsRequest<ReportSchedule>({
    method: 'PUT',
    url: `reports/schedules/${scheduleId}`,
    data: body,
  });
}

export async function apiDeleteSchedule(scheduleId: string): Promise<void> {
  await reportsRequest<void>({
    method: 'DELETE',
    url: `reports/schedules/${scheduleId}`,
  });
}

export async function apiToggleSchedule(scheduleId: string, active: boolean): Promise<{ message: string; active: boolean }> {
  return reportsRequest<{ message: string; active: boolean }>({
    method: 'POST',
    url: `reports/schedules/${scheduleId}/toggle`,
    data: { active },
  });
}

export async function apiBenchmarkComparison(body: BenchmarkComparisonRequest): Promise<BenchmarkComparisonResponse> {
  return reportsRequest<BenchmarkComparisonResponse>({
    method: 'POST',
    url: 'reports/benchmark/comparison',
    data: body,
  });
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
  const data = await reportsRequest<{ benchmarks: BenchmarkDataset[] }>({
    method: 'GET',
    url: `reports/benchmarks?${q.toString()}`,
  });
  return data?.benchmarks ?? [];
}
