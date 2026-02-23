import type {
  ReportDefinition,
  ReportExecution,
  ReportSchedule,
  DashboardWidget,
  DashboardSummary,
  BenchmarkComparisonResponse,
  DatasetMetadata,
} from './reports.types';

export type ReportsState = {
  reports: ReportDefinition[];
  reportsTotal: number;
  reportsPage: number;
  reportsLoading: boolean;
  reportsError: string | null;
  currentReport: ReportDefinition | null;
  executions: ReportExecution[];
  executionsTotal: number;
  executionsLoading: boolean;
  executionsError: string | null;
  schedules: ReportSchedule[];
  schedulesTotal: number;
  schedulesLoading: boolean;
  schedulesError: string | null;
  dashboardSummary: DashboardSummary | null;
  dashboardSummaryLoading: boolean;
  dashboardSummaryError: string | null;
  dashboardSummaryCachedAt: number | null;
  widgets: DashboardWidget[];
  widgetsLoading: boolean;
  widgetsError: string | null;
  datasets: DatasetMetadata[];
  datasetsLoading: boolean;
  datasetsError: string | null;
  benchmarkResult: BenchmarkComparisonResponse | null;
  benchmarkLoading: boolean;
  benchmarkError: string | null;
  templates: ReportDefinition[];
  templatesLoading: boolean;
  templatesError: string | null;
};

export function selectReportById(state: ReportsState, id: string): ReportDefinition | undefined {
  const fromList = state.reports.find((r) => r.id === id);
  if (fromList) return fromList;
  if (state.currentReport && state.currentReport.id === id) return state.currentReport;
  return undefined;
}

export function selectExecutionById(state: ReportsState, id: string): ReportExecution | undefined {
  return state.executions.find((e) => e.id === id);
}

export function selectScheduleById(state: ReportsState, id: string): ReportSchedule | undefined {
  return state.schedules.find((s) => s.id === id);
}

export function selectWidgetById(state: ReportsState, id: string): DashboardWidget | undefined {
  return state.widgets.find((w) => w.id === id);
}

export function selectReportsStatus(state: ReportsState): { loading: boolean; error: string | null } {
  return { loading: state.reportsLoading, error: state.reportsError };
}

export function selectDashboardSummaryWithCache(state: ReportsState): {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  cachedAt: number | null;
} {
  return {
    summary: state.dashboardSummary,
    loading: state.dashboardSummaryLoading,
    error: state.dashboardSummaryError,
    cachedAt: state.dashboardSummaryCachedAt,
  };
}

export function selectExecutionsForReport(state: ReportsState, reportId: string): ReportExecution[] {
  return state.executions.filter((e) => e.report_definition_id === reportId);
}

export function selectSchedulesForReport(state: ReportsState, reportId: string): ReportSchedule[] {
  return state.schedules.filter((s) => s.report_definition_id === reportId);
}
