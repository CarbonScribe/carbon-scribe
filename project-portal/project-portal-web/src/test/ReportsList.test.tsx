import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import ReportsList from "@/components/reports/ReportsList";
import { useStore } from "@/lib/store/store";

const defaultReportsState = {
  reports: [],
  reportsTotal: 0,
  reportsPage: 1,
  reportsQuery: undefined,
  reportsLoading: false,
  reportsError: null,
  currentReport: null,
  fetchReports: vi.fn().mockResolvedValue(undefined),
  fetchReport: vi.fn().mockResolvedValue(undefined),
  createReport: vi.fn().mockResolvedValue(undefined),
  updateReport: vi.fn().mockResolvedValue(undefined),
  deleteReport: vi.fn().mockResolvedValue(undefined),
  cloneReport: vi.fn().mockResolvedValue(undefined),
  setCurrentReport: vi.fn(),
  clearCurrentReport: vi.fn(),
  templates: [],
  templatesLoading: false,
  templatesError: null,
  fetchTemplates: vi.fn().mockResolvedValue(undefined),
  executions: [],
  executionsTotal: 0,
  executionsLoading: false,
  executionsError: null,
  fetchExecutions: vi.fn().mockResolvedValue(undefined),
  executeReport: vi.fn().mockResolvedValue(undefined),
  fetchExecution: vi.fn().mockResolvedValue(undefined),
  cancelExecution: vi.fn().mockResolvedValue(undefined),
  pollExecutionUntilDone: vi.fn().mockResolvedValue(undefined),
  schedules: [],
  schedulesTotal: 0,
  schedulesLoading: false,
  schedulesError: null,
  fetchSchedules: vi.fn().mockResolvedValue(undefined),
  createSchedule: vi.fn().mockResolvedValue(undefined),
  updateSchedule: vi.fn().mockResolvedValue(undefined),
  deleteSchedule: vi.fn().mockResolvedValue(undefined),
  toggleSchedule: vi.fn().mockResolvedValue(undefined),
  dashboardSummary: null,
  dashboardSummaryLoading: false,
  dashboardSummaryError: null,
  dashboardSummaryCachedAt: null,
  fetchDashboardSummary: vi.fn().mockResolvedValue(undefined),
  widgets: [],
  widgetsLoading: false,
  widgetsError: null,
  fetchWidgets: vi.fn().mockResolvedValue(undefined),
  createWidget: vi.fn().mockResolvedValue(undefined),
  updateWidget: vi.fn().mockResolvedValue(undefined),
  deleteWidget: vi.fn().mockResolvedValue(undefined),
  datasets: [],
  datasetsLoading: false,
  datasetsError: null,
  fetchDatasets: vi.fn().mockResolvedValue(undefined),
  benchmarkResult: null,
  benchmarkLoading: false,
  benchmarkError: null,
  fetchBenchmarkComparison: vi.fn().mockResolvedValue(undefined),
  clearBenchmark: vi.fn(),
  clearReports: vi.fn(),
};

function resetStore(overrides = {}) {
  useStore.setState({ ...defaultReportsState, ...overrides } as any, true);
}

describe("ReportsList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetchReports on mount with default query params", async () => {
    const fetchReports = vi.fn().mockResolvedValue(undefined);
    resetStore({ fetchReports });

    await act(async () => {
      render(<ReportsList />);
    });

    expect(fetchReports).toHaveBeenCalledTimes(1);
    expect(fetchReports).toHaveBeenCalledWith(
      {
        category: undefined,
        is_template: false,
        page: 1,
        page_size: 50,
      },
      expect.any(Object),
    );
  });

  it("refetches when category prop changes", async () => {
    const fetchReports = vi.fn().mockResolvedValue(undefined);
    resetStore({ fetchReports });

    const { rerender } = render(<ReportsList category="finance" />);

    await act(async () => {
      rerender(<ReportsList category="compliance" />);
    });

    expect(fetchReports).toHaveBeenCalledTimes(2);
    expect(fetchReports.mock.calls[1][0]).toEqual({
      category: "compliance",
      is_template: false,
      page: 1,
      page_size: 50,
    });
  });

  it("shows an error panel and retry button when fetch fails", async () => {
    const fetchReports = vi.fn().mockResolvedValue(undefined);
    resetStore({ fetchReports, reportsError: "Network failure", reports: [] });

    render(<ReportsList />);

    expect(screen.getByText(/Unable to load reports/i)).toBeVisible();
    expect(screen.getByText(/Network failure/i)).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    });

    expect(fetchReports).toHaveBeenCalledTimes(2);
    expect(fetchReports.mock.calls[1][0]).toEqual({
      category: undefined,
      is_template: false,
      page: 1,
      page_size: 50,
    });
  });
});
