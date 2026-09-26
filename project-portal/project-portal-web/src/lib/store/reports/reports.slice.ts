import type { StateCreator } from "zustand";
import type {
  ReportDefinition,
  ReportExecution,
  ReportSchedule,
  DashboardSummary,
  DashboardWidget,
  CreateReportRequest,
  UpdateReportRequest,
  ExecuteReportRequest,
  CreateScheduleRequest,
  BenchmarkComparisonRequest,
  BenchmarkComparisonResponse,
  DatasetMetadata,
  WidgetConfig,
} from "./reports.types";

import * as api from "./reports.api";

const DASHBOARD_SUMMARY_CACHE_MS = 60 * 1000;

export interface ReportsSlice {
  reports: ReportDefinition[];
  reportsTotal: number;
  reportsPage: number;
  reportsQuery?: Parameters<typeof api.apiListReports>[0];
  reportsLoading: boolean;
  reportsError: string | null;
  currentReport: ReportDefinition | null;
  fetchReports: (
    params?: Parameters<typeof api.apiListReports>[0],
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
  fetchReport: (id: string) => Promise<void>;
  createReport: (body: CreateReportRequest) => Promise<ReportDefinition>;
  updateReport: (id: string, body: UpdateReportRequest) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  cloneReport: (id: string, name: string) => Promise<ReportDefinition>;
  setCurrentReport: (r: ReportDefinition | null) => void;
  clearCurrentReport: () => void;

  templates: ReportDefinition[];
  templatesLoading: boolean;
  templatesError: string | null;
  fetchTemplates: () => Promise<void>;

  executions: ReportExecution[];
  executionsTotal: number;
  executionsLoading: boolean;
  executionsError: string | null;
  fetchExecutions: (
    params?: Parameters<typeof api.apiListExecutions>[0],
  ) => Promise<void>;
  executeReport: (
    id: string,
    body?: ExecuteReportRequest,
  ) => Promise<ReportExecution>;
  fetchExecution: (executionId: string) => Promise<ReportExecution>;
  cancelExecution: (executionId: string) => Promise<void>;
  pollExecutionUntilDone: (
    executionId: string,
    onProgress?: (e: ReportExecution) => void,
  ) => Promise<ReportExecution>;

  schedules: ReportSchedule[];
  schedulesTotal: number;
  schedulesLoading: boolean;
  schedulesError: string | null;
  fetchSchedules: (
    params?: Parameters<typeof api.apiListSchedules>[0],
  ) => Promise<void>;
  createSchedule: (body: CreateScheduleRequest) => Promise<ReportSchedule>;
  updateSchedule: (id: string, body: CreateScheduleRequest) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  toggleSchedule: (id: string, active: boolean) => Promise<void>;

  dashboardSummary: DashboardSummary | null;
  dashboardSummaryLoading: boolean;
  dashboardSummaryError: string | null;
  dashboardSummaryCachedAt: number | null;
  fetchDashboardSummary: (force?: boolean) => Promise<void>;

  widgets: DashboardWidget[];
  widgetsLoading: boolean;
  widgetsError: string | null;
  fetchWidgets: (section?: string) => Promise<void>;
  createWidget: (
    widget: Omit<DashboardWidget, "id" | "created_at" | "updated_at">,
  ) => Promise<DashboardWidget>;
  updateWidget: (
    widgetId: string,
    widget: Partial<DashboardWidget> & { config: WidgetConfig },
  ) => Promise<void>;
  deleteWidget: (widgetId: string) => Promise<void>;

  datasets: DatasetMetadata[];
  datasetsLoading: boolean;
  datasetsError: string | null;
  datasetsPage: number;
  datasetsPageSize: number;
  datasetsTotal: number;
  datasetsHasMore: boolean;
  fetchDatasets: (params?: { page?: number; pageSize?: number }) => Promise<void>;

  benchmarkResult: BenchmarkComparisonResponse | null;
  benchmarkLoading: boolean;
  benchmarkError: string | null;
  fetchBenchmarkComparison: (body: BenchmarkComparisonRequest) => Promise<void>;
  clearBenchmark: () => void;

  clearReports: () => void;
}

const initialState = {
  reports: [],
  reportsTotal: 0,
  reportsPage: 1,
  reportsQuery: undefined as Parameters<typeof api.apiListReports>[0] | undefined,
  reportsLoading: false,
  reportsError: null as string | null,
  currentReport: null as ReportDefinition | null,
  templates: [] as ReportDefinition[],
  templatesLoading: false,
  templatesError: null as string | null,
  executions: [],
  executionsTotal: 0,
  executionsLoading: false,
  executionsError: null as string | null,
  schedules: [],
  schedulesTotal: 0,
  schedulesLoading: false,
  schedulesError: null as string | null,
  dashboardSummary: null as DashboardSummary | null,
  dashboardSummaryLoading: false,
  dashboardSummaryError: null as string | null,
  dashboardSummaryCachedAt: null as number | null,
  widgets: [],
  widgetsLoading: false,
  widgetsError: null as string | null,
  datasets: [],
  datasetsLoading: false,
  datasetsError: null as string | null,
  datasetsPage: 1,
  datasetsPageSize: 8,
  datasetsTotal: 0,
  datasetsHasMore: false,
  benchmarkResult: null as BenchmarkComparisonResponse | null,
  benchmarkLoading: false,
  benchmarkError: null as string | null,
};

export const createReportsSlice: StateCreator<
  ReportsSlice,
  [],
  [],
  ReportsSlice
> = (set, get) => ({
  ...initialState,

  fetchReports: async (params, options) => {
    set({ reportsLoading: true, reportsError: null, reportsQuery: params });
    try {
      const res = await api.apiListReports(params, {
        signal: options?.signal,
      });
      set({
        reports: res.reports,
        reportsTotal: res.total,
        reportsPage: res.page,
        reportsLoading: false,
        reportsError: null,
      });
    } catch (e) {
      const error = e as any;
      if (error?.code === "ERR_CANCELED") {
        set({ reportsLoading: false });
        return;
      }
      set({ reportsLoading: false, reportsError: (e as Error).message });
    }
  },

  fetchReport: async (id) => {
    set({ reportsError: null });
    try {
      const report = await api.apiGetReport(id);
      set({ currentReport: report });
    } catch (e) {
      set({ currentReport: null, reportsError: (e as Error).message });
    }
  },

  createReport: async (body) => {
    const report = await api.apiCreateReport(body);
    set((s) => ({
      reports: [report, ...s.reports],
      reportsTotal: s.reportsTotal + 1,
      currentReport: report,
    }));
    get()
      .fetchReports(get().reportsQuery ?? { page: 1, page_size: 50 })
      .catch(() => {});
    return report;
  },

  updateReport: async (id, body) => {
    const updated = await api.apiUpdateReport(id, body);
    set((s) => ({
      reports: s.reports.map((r) => (r.id === id ? updated : r)),
      currentReport: s.currentReport?.id === id ? updated : s.currentReport,
    }));
    get()
      .fetchReports(get().reportsQuery ?? { page: 1, page_size: 50 })
      .catch(() => {});
  },

  deleteReport: async (id) => {
    await api.apiDeleteReport(id);
    set((s) => ({
      reports: s.reports.filter((r) => r.id !== id),
      reportsTotal: Math.max(0, s.reportsTotal - 1),
      currentReport: s.currentReport?.id === id ? null : s.currentReport,
    }));
    get()
      .fetchReports(get().reportsQuery ?? { page: 1, page_size: 50 })
      .catch(() => {});
  },

  cloneReport: async (id, name) => {
    const report = await api.apiCloneReport(id, name);
    set((s) => ({
      reports: [report, ...s.reports],
      reportsTotal: s.reportsTotal + 1,
      currentReport: report,
    }));
    get()
      .fetchReports(get().reportsQuery ?? { page: 1, page_size: 50 })
      .catch(() => {});
    return report;
  },

  setCurrentReport: (r) => set({ currentReport: r }),
  clearCurrentReport: () => set({ currentReport: null }),

  fetchTemplates: async () => {
    set({ templatesLoading: true, templatesError: null });
    try {
      const templates = await api.apiListTemplates();
      set({ templates, templatesLoading: false, templatesError: null });
    } catch (e) {
      set({ templatesLoading: false, templatesError: (e as Error).message });
    }
  },

  fetchExecutions: async (params) => {
    set({ executionsLoading: true, executionsError: null });
    try {
      const res = await api.apiListExecutions(params);
      set({
        executions: res.executions,
        executionsTotal: res.total,
        executionsLoading: false,
        executionsError: null,
      });
    } catch (e) {
      set({ executionsLoading: false, executionsError: (e as Error).message });
    }
  },

  executeReport: async (id, body) => {
    const execution = await api.apiExecuteReport(id, body);
    set((s) => ({
      executions: [execution, ...s.executions],
      executionsTotal: s.executionsTotal + 1,
    }));
    return execution;
  },

  fetchExecution: async (executionId) => {
    return api.apiGetExecution(executionId);
  },

  cancelExecution: async (executionId) => {
    await api.apiCancelExecution(executionId);
    set((s) => ({
      executions: s.executions.map((e) =>
        e.id === executionId ? { ...e, status: "failed" as const } : e,
      ),
    }));
  },

  pollExecutionUntilDone: async (executionId, onProgress) => {
    const poll = async (): Promise<ReportExecution> => {
      const e = await api.apiGetExecution(executionId);
      onProgress?.(e);
      if (e.status === "completed" || e.status === "failed") return e;
      await new Promise((r) => setTimeout(r, 1500));
      return poll();
    };
    const final = await poll();
    set((s) => ({
      executions: s.executions.map((e) => (e.id === executionId ? final : e)),
    }));
    return final;
  },

  fetchSchedules: async (params) => {
    set({ schedulesLoading: true, schedulesError: null });
    try {
      const res = await api.apiListSchedules(params);
      set({
        schedules: res.schedules,
        schedulesTotal: res.total,
        schedulesLoading: false,
        schedulesError: null,
      });
    } catch (e) {
      set({ schedulesLoading: false, schedulesError: (e as Error).message });
    }
  },

  createSchedule: async (body) => {
    const schedule = await api.apiCreateSchedule(body);
    set((s) => ({
      schedules: [schedule, ...s.schedules],
      schedulesTotal: s.schedulesTotal + 1,
    }));
    return schedule;
  },

  updateSchedule: async (id, body) => {
    const updated = await api.apiUpdateSchedule(id, body);
    set((s) => ({
      schedules: s.schedules.map((sched) =>
        sched.id === id ? updated : sched,
      ),
    }));
  },

  deleteSchedule: async (id) => {
    await api.apiDeleteSchedule(id);
    set((s) => ({
      schedules: s.schedules.filter((sched) => sched.id !== id),
      schedulesTotal: Math.max(0, s.schedulesTotal - 1),
    }));
  },

  toggleSchedule: async (id, active) => {
    await api.apiToggleSchedule(id, active);
    set((s) => ({
      schedules: s.schedules.map((sched) =>
        sched.id === id ? { ...sched, is_active: active } : sched,
      ),
    }));
  },

  fetchDashboardSummary: async (force = false) => {
    const { dashboardSummaryCachedAt } = get();
    if (
      !force &&
      dashboardSummaryCachedAt &&
      Date.now() - dashboardSummaryCachedAt < DASHBOARD_SUMMARY_CACHE_MS
    ) {
      return;
    }
    set({ dashboardSummaryLoading: true, dashboardSummaryError: null });
    try {
      const summary = await api.apiGetDashboardSummary();
      set({
        dashboardSummary: summary,
        dashboardSummaryLoading: false,
        dashboardSummaryError: null,
        dashboardSummaryCachedAt: Date.now(),
      });
    } catch (e) {
      set({
        dashboardSummaryLoading: false,
        dashboardSummaryError: (e as Error).message,
      });
    }
  },

  fetchWidgets: async (section) => {
    set({ widgetsLoading: true, widgetsError: null });
    try {
      const widgets = await api.apiGetWidgets(section);
      set({ widgets, widgetsLoading: false, widgetsError: null });
    } catch (e) {
      set({ widgetsLoading: false, widgetsError: (e as Error).message });
    }
  },

  createWidget: async (widget) => {
    const created = await api.apiCreateWidget(widget);
    set((s) => ({
      widgets: [...s.widgets, created].sort((a, b) => a.position - b.position),
    }));
    return created;
  },

  updateWidget: async (widgetId, widget) => {
    const updated = await api.apiUpdateWidget(widgetId, widget);
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === widgetId ? updated : w)),
    }));
  },

  deleteWidget: async (widgetId) => {
    await api.apiDeleteWidget(widgetId);
    set((s) => ({ widgets: s.widgets.filter((w) => w.id !== widgetId) }));
  },

  fetchDatasets: async (params = {}) => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 8;

    if (page === 1) {
      set({ datasetsLoading: true, datasetsError: null });
    } else {
      set((state) => ({ datasetsLoading: state.datasetsLoading, datasetsError: null }));
    }

    try {
      const response = await api.apiGetDatasets({ page, pageSize });
      const datasets = response.datasets ?? [];
      const total = response.total ?? datasets.length;
      const hasMore = page * pageSize < total;

      set((state) => ({
        datasets: page === 1 ? datasets : [...state.datasets, ...datasets],
        datasetsLoading: false,
        datasetsError: null,
        datasetsPage: page,
        datasetsPageSize: pageSize,
        datasetsTotal: total,
        datasetsHasMore: hasMore,
      }));
    } catch (e) {
      set({ datasetsLoading: false, datasetsError: (e as Error).message });
    }
  },

  fetchBenchmarkComparison: async (body) => {
    set({ benchmarkLoading: true, benchmarkError: null });
    try {
      const result = await api.apiBenchmarkComparison(body);
      set({
        benchmarkResult: result,
        benchmarkLoading: false,
        benchmarkError: null,
      });
    } catch (e) {
      set({ benchmarkLoading: false, benchmarkError: (e as Error).message });
    }
  },

  clearBenchmark: () => set({ benchmarkResult: null, benchmarkError: null }),

  clearReports: () => set(initialState),
});
