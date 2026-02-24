export type ReportCategory = 'financial' | 'operational' | 'compliance' | 'custom';
export type ReportVisibility = 'private' | 'shared' | 'public';
export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';
export type DeliveryMethod = 'email' | 's3' | 'webhook';
export type ExecutionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type WidgetType = 'chart' | 'metric' | 'table' | 'gauge';
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type AggregateFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

export interface FieldConfig {
  name: string;
  alias?: string;
  aggregate?: AggregateFunction;
  format?: string;
  is_hidden?: boolean;
  sort_order?: number;
  data_type?: string;
  is_editable?: boolean;
}

export interface FilterConfig {
  field: string;
  operator: string;
  value: unknown;
  logic?: 'AND' | 'OR';
}

export interface GroupConfig {
  field: string;
  order: number;
  time_grain?: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  order: number;
}

export interface CalculationConfig {
  name: string;
  expression: string;
  data_type: string;
}

export interface ReportConfig {
  dataset: string;
  fields: FieldConfig[];
  filters?: FilterConfig[];
  groupings?: GroupConfig[];
  sorts?: SortConfig[];
  calculations?: CalculationConfig[];
  limit?: number;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  category?: ReportCategory;
  config: ReportConfig;
  created_by?: string;
  visibility: ReportVisibility;
  shared_with_users?: string[];
  shared_with_roles?: string[];
  version: number;
  is_template: boolean;
  based_on_template_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  report_definition_id: string;
  name: string;
  cron_expression: string;
  timezone: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  format: ExportFormat;
  delivery_method: DeliveryMethod;
  delivery_config: Record<string, unknown>;
  recipient_emails?: string[];
  recipient_user_ids?: string[];
  webhook_url?: string;
  created_at: string;
  updated_at: string;
  report_definition?: ReportDefinition;
}

export interface ReportExecution {
  id: string;
  report_definition_id?: string;
  schedule_id?: string;
  triggered_by?: string;
  triggered_at: string;
  completed_at?: string;
  status: ExecutionStatus;
  error_message?: string;
  record_count?: number;
  file_size_bytes?: number;
  file_key?: string;
  download_url?: string;
  delivery_status?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  execution_log?: string;
  created_at: string;
  report_definition?: ReportDefinition;
  schedule?: ReportSchedule;
}

export interface BenchmarkDataset {
  id: string;
  name: string;
  description?: string;
  category: string;
  methodology?: string;
  region?: string;
  data: Record<string, unknown>;
  year: number;
  source?: string;
  confidence_score?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  user_id?: string;
  dashboard_section?: string;
  widget_type: WidgetType;
  title: string;
  config: WidgetConfig;
  size: WidgetSize;
  position: number;
  refresh_interval_seconds: number;
  last_refreshed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  data_source?: string;
  refresh_rate?: number;
  filters?: FilterConfig[];
  color_scheme?: string;
  show_legend?: boolean;
  custom_styles?: Record<string, string>;
  chart_type?: string;
  x_axis?: string;
  y_axis?: string[];
  stacked?: boolean;
  show_data_labels?: boolean;
  metric_field?: string;
  compare_field?: string;
  trend_period?: string;
  display_format?: string;
  prefix?: string;
  suffix?: string;
  min_value?: number;
  max_value?: number;
  thresholds?: Array<{ value: number; color: string; label?: string }>;
  columns?: FieldConfig[];
  page_size?: number;
  sortable?: boolean;
  searchable?: boolean;
}

export interface MetricSummary {
  value: number;
  change: number;
  change_percent: number;
  period: string;
  trend: 'up' | 'down' | 'stable';
}

export interface TimeSeriesPoint {
  time: string;
  value: number;
  label?: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user_id?: string;
  entity_id?: string;
  entity_type?: string;
}

export interface DashboardSummary {
  total_projects: number;
  total_credits: number;
  total_revenue: number;
  active_monitoring_areas: number;
  recent_activity: ActivityItem[];
  performance_metrics: Record<string, MetricSummary>;
  time_series_data?: Record<string, TimeSeriesPoint[]>;
}

export interface DatasetMetadata {
  name: string;
  display_name: string;
  description: string;
  fields: FieldMetadata[];
  join_with?: string[];
}

export interface FieldMetadata {
  name: string;
  display_name: string;
  data_type: string;
  is_aggregatable: boolean;
  is_filterable: boolean;
  is_groupable: boolean;
  allowed_values?: string[];
}

export interface BenchmarkResult {
  metric: string;
  project_value: number;
  benchmark_value: number;
  difference: number;
  difference_percent: number;
  performance_level: 'above' | 'at' | 'below';
}

export interface GapAnalysisResult {
  metric: string;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface BenchmarkComparisonResponse {
  project_id: string;
  project_metrics: Record<string, number>;
  benchmarks: BenchmarkResult[];
  percentile_rank: Record<string, number>;
  gap_analysis: GapAnalysisResult[];
}

export interface CreateReportRequest {
  name: string;
  description?: string;
  category?: ReportCategory;
  config: ReportConfig;
  visibility?: ReportVisibility;
  is_template?: boolean;
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  category?: ReportCategory;
  config?: ReportConfig;
  visibility?: ReportVisibility;
}

export interface ExecuteReportRequest {
  format?: ExportFormat;
  parameters?: Record<string, unknown>;
}

export interface CreateScheduleRequest {
  report_definition_id: string;
  name: string;
  cron_expression: string;
  timezone?: string;
  start_date?: string;
  end_date?: string;
  format: ExportFormat;
  delivery_method: DeliveryMethod;
  delivery_config: Record<string, unknown>;
  recipient_emails?: string[];
  recipient_user_ids?: string[];
  webhook_url?: string;
}

export interface BenchmarkComparisonRequest {
  project_id: string;
  category: string;
  methodology?: string;
  region?: string;
  year?: number;
}

export interface ListReportsResponse {
  reports: ReportDefinition[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListExecutionsResponse {
  executions: ReportExecution[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
