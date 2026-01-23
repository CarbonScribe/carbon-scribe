package reports

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository defines the interface for report data access
type Repository interface {
	// Report Definitions
	CreateReportDefinition(ctx context.Context, report *ReportDefinition) error
	GetReportDefinition(ctx context.Context, id uuid.UUID) (*ReportDefinition, error)
	UpdateReportDefinition(ctx context.Context, report *ReportDefinition) error
	DeleteReportDefinition(ctx context.Context, id uuid.UUID) error
	ListReportDefinitions(ctx context.Context, filters *ReportFilters) ([]*ReportDefinition, int, error)
	GetReportTemplates(ctx context.Context) ([]*ReportDefinition, error)

	// Report Schedules
	CreateSchedule(ctx context.Context, schedule *ReportSchedule) error
	GetSchedule(ctx context.Context, id uuid.UUID) (*ReportSchedule, error)
	UpdateSchedule(ctx context.Context, schedule *ReportSchedule) error
	DeleteSchedule(ctx context.Context, id uuid.UUID) error
	ListSchedules(ctx context.Context, filters *ScheduleFilters) ([]*ReportSchedule, int, error)
	GetDueSchedules(ctx context.Context, limit int) ([]*ReportSchedule, error)
	UpdateScheduleExecution(ctx context.Context, id uuid.UUID, lastExecuted, nextExecution time.Time) error

	// Report Executions
	CreateExecution(ctx context.Context, execution *ReportExecution) error
	GetExecution(ctx context.Context, id uuid.UUID) (*ReportExecution, error)
	UpdateExecution(ctx context.Context, execution *ReportExecution) error
	ListExecutions(ctx context.Context, filters *ExecutionFilters) ([]*ReportExecution, int, error)
	GetPendingExecutions(ctx context.Context, limit int) ([]*ReportExecution, error)

	// Benchmark Datasets
	CreateBenchmark(ctx context.Context, benchmark *BenchmarkDataset) error
	GetBenchmark(ctx context.Context, id uuid.UUID) (*BenchmarkDataset, error)
	UpdateBenchmark(ctx context.Context, benchmark *BenchmarkDataset) error
	DeleteBenchmark(ctx context.Context, id uuid.UUID) error
	ListBenchmarks(ctx context.Context, filters *BenchmarkFilters) ([]*BenchmarkDataset, int, error)
	GetBenchmarksByCategory(ctx context.Context, category BenchmarkCategory, methodology, region *string, year *int) ([]*BenchmarkDataset, error)

	// Dashboard Widgets
	CreateWidget(ctx context.Context, widget *DashboardWidget) error
	GetWidget(ctx context.Context, id uuid.UUID) (*DashboardWidget, error)
	UpdateWidget(ctx context.Context, widget *DashboardWidget) error
	DeleteWidget(ctx context.Context, id uuid.UUID) error
	GetUserWidgets(ctx context.Context, userID uuid.UUID, section *string) ([]*DashboardWidget, error)
	UpdateWidgetCache(ctx context.Context, id uuid.UUID, data JSONB) error

	// Dashboard Aggregates
	GetAggregate(ctx context.Context, key string) (*DashboardAggregate, error)
	UpsertAggregate(ctx context.Context, aggregate *DashboardAggregate) error
	GetStaleAggregates(ctx context.Context, limit int) ([]*DashboardAggregate, error)
	MarkAggregatesStale(ctx context.Context, aggregateType string, projectID *uuid.UUID) error

	// Data Sources
	GetDataSources(ctx context.Context) ([]*ReportDataSource, error)
	GetDataSource(ctx context.Context, name string) (*ReportDataSource, error)

	// Dynamic Query Execution
	ExecuteReportQuery(ctx context.Context, config *ReportConfig, params map[string]interface{}) ([]map[string]interface{}, int, error)
}

// PostgresRepository implements Repository using PostgreSQL
type PostgresRepository struct {
	db *sqlx.DB
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(db *sqlx.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// =====================================================
// Report Definitions
// =====================================================

func (r *PostgresRepository) CreateReportDefinition(ctx context.Context, report *ReportDefinition) error {
	configJSON, err := json.Marshal(report.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	query := `
		INSERT INTO report_definitions (
			id, name, description, category, config, created_by, visibility,
			shared_with_users, shared_with_roles, version, is_template, based_on_template_id,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)
	`

	_, err = r.db.ExecContext(ctx, query,
		report.ID, report.Name, report.Description, report.Category, configJSON,
		report.CreatedBy, report.Visibility, report.SharedWithUsers, report.SharedWithRoles,
		report.Version, report.IsTemplate, report.BasedOnTemplateID,
		report.CreatedAt, report.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create report definition: %w", err)
	}

	return nil
}

func (r *PostgresRepository) GetReportDefinition(ctx context.Context, id uuid.UUID) (*ReportDefinition, error) {
	query := `
		SELECT id, name, description, category, config, created_by, visibility,
			   shared_with_users, shared_with_roles, version, is_template, based_on_template_id,
			   created_at, updated_at
		FROM report_definitions
		WHERE id = $1
	`

	var report ReportDefinition
	var configJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&report.ID, &report.Name, &report.Description, &report.Category, &configJSON,
		&report.CreatedBy, &report.Visibility, &report.SharedWithUsers, &report.SharedWithRoles,
		&report.Version, &report.IsTemplate, &report.BasedOnTemplateID,
		&report.CreatedAt, &report.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("report definition not found")
		}
		return nil, fmt.Errorf("failed to get report definition: %w", err)
	}

	if err := json.Unmarshal(configJSON, &report.Config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &report, nil
}

func (r *PostgresRepository) UpdateReportDefinition(ctx context.Context, report *ReportDefinition) error {
	configJSON, err := json.Marshal(report.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	query := `
		UPDATE report_definitions SET
			name = $2, description = $3, category = $4, config = $5,
			visibility = $6, shared_with_users = $7, shared_with_roles = $8,
			version = $9, updated_at = $10
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query,
		report.ID, report.Name, report.Description, report.Category, configJSON,
		report.Visibility, report.SharedWithUsers, report.SharedWithRoles,
		report.Version, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to update report definition: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("report definition not found")
	}

	return nil
}

func (r *PostgresRepository) DeleteReportDefinition(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM report_definitions WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete report definition: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("report definition not found")
	}

	return nil
}

func (r *PostgresRepository) ListReportDefinitions(ctx context.Context, filters *ReportFilters) ([]*ReportDefinition, int, error) {
	var conditions []string
	var args []interface{}
	argCount := 0

	baseQuery := `
		SELECT id, name, description, category, config, created_by, visibility,
			   shared_with_users, shared_with_roles, version, is_template, based_on_template_id,
			   created_at, updated_at
		FROM report_definitions
	`

	countQuery := `SELECT COUNT(*) FROM report_definitions`

	if filters.Category != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("category = $%d", argCount))
		args = append(args, *filters.Category)
	}

	if filters.Visibility != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("visibility = $%d", argCount))
		args = append(args, *filters.Visibility)
	}

	if filters.CreatedBy != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("created_by = $%d", argCount))
		args = append(args, *filters.CreatedBy)
	}

	if filters.IsTemplate != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("is_template = $%d", argCount))
		args = append(args, *filters.IsTemplate)
	}

	if filters.SearchTerm != nil && *filters.SearchTerm != "" {
		argCount++
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", argCount, argCount))
		args = append(args, "%"+*filters.SearchTerm+"%")
	}

	if filters.CreatedAfter != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", argCount))
		args = append(args, *filters.CreatedAfter)
	}

	if filters.CreatedBefore != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", argCount))
		args = append(args, *filters.CreatedBefore)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Get total count
	var totalCount int
	err := r.db.QueryRowContext(ctx, countQuery+whereClause, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count reports: %w", err)
	}

	// Add pagination
	offset := (filters.Page - 1) * filters.PageSize
	if filters.Page < 1 {
		offset = 0
	}

	argCount++
	limitArg := argCount
	argCount++
	offsetArg := argCount

	query := baseQuery + whereClause + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", limitArg, offsetArg)
	args = append(args, filters.PageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list reports: %w", err)
	}
	defer rows.Close()

	var reports []*ReportDefinition
	for rows.Next() {
		var report ReportDefinition
		var configJSON []byte

		err := rows.Scan(
			&report.ID, &report.Name, &report.Description, &report.Category, &configJSON,
			&report.CreatedBy, &report.Visibility, &report.SharedWithUsers, &report.SharedWithRoles,
			&report.Version, &report.IsTemplate, &report.BasedOnTemplateID,
			&report.CreatedAt, &report.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan report: %w", err)
		}

		if err := json.Unmarshal(configJSON, &report.Config); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal config: %w", err)
		}

		reports = append(reports, &report)
	}

	return reports, totalCount, nil
}

func (r *PostgresRepository) GetReportTemplates(ctx context.Context) ([]*ReportDefinition, error) {
	isTemplate := true
	filters := &ReportFilters{
		IsTemplate: &isTemplate,
		Page:       1,
		PageSize:   100,
	}

	templates, _, err := r.ListReportDefinitions(ctx, filters)
	return templates, err
}

// =====================================================
// Report Schedules
// =====================================================

func (r *PostgresRepository) CreateSchedule(ctx context.Context, schedule *ReportSchedule) error {
	deliveryConfigJSON, err := json.Marshal(schedule.DeliveryConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery config: %w", err)
	}

	query := `
		INSERT INTO report_schedules (
			id, report_definition_id, name, cron_expression, timezone, start_date, end_date,
			is_active, format, delivery_method, delivery_config, recipient_emails,
			recipient_user_ids, webhook_url, next_execution_at, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
		)
	`

	_, err = r.db.ExecContext(ctx, query,
		schedule.ID, schedule.ReportDefinitionID, schedule.Name, schedule.CronExpression,
		schedule.Timezone, schedule.StartDate, schedule.EndDate, schedule.IsActive,
		schedule.Format, schedule.DeliveryMethod, deliveryConfigJSON, schedule.RecipientEmails,
		schedule.RecipientUserIDs, schedule.WebhookURL, schedule.NextExecutionAt,
		schedule.CreatedBy, schedule.CreatedAt, schedule.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create schedule: %w", err)
	}

	return nil
}

func (r *PostgresRepository) GetSchedule(ctx context.Context, id uuid.UUID) (*ReportSchedule, error) {
	query := `
		SELECT id, report_definition_id, name, cron_expression, timezone, start_date, end_date,
			   is_active, format, delivery_method, delivery_config, recipient_emails,
			   recipient_user_ids, webhook_url, last_executed_at, next_execution_at,
			   execution_count, created_by, created_at, updated_at
		FROM report_schedules
		WHERE id = $1
	`

	var schedule ReportSchedule
	var deliveryConfigJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&schedule.ID, &schedule.ReportDefinitionID, &schedule.Name, &schedule.CronExpression,
		&schedule.Timezone, &schedule.StartDate, &schedule.EndDate, &schedule.IsActive,
		&schedule.Format, &schedule.DeliveryMethod, &deliveryConfigJSON, &schedule.RecipientEmails,
		&schedule.RecipientUserIDs, &schedule.WebhookURL, &schedule.LastExecutedAt,
		&schedule.NextExecutionAt, &schedule.ExecutionCount, &schedule.CreatedBy,
		&schedule.CreatedAt, &schedule.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("schedule not found")
		}
		return nil, fmt.Errorf("failed to get schedule: %w", err)
	}

	if err := json.Unmarshal(deliveryConfigJSON, &schedule.DeliveryConfig); err != nil {
		return nil, fmt.Errorf("failed to unmarshal delivery config: %w", err)
	}

	return &schedule, nil
}

func (r *PostgresRepository) UpdateSchedule(ctx context.Context, schedule *ReportSchedule) error {
	deliveryConfigJSON, err := json.Marshal(schedule.DeliveryConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery config: %w", err)
	}

	query := `
		UPDATE report_schedules SET
			name = $2, cron_expression = $3, timezone = $4, start_date = $5, end_date = $6,
			is_active = $7, format = $8, delivery_method = $9, delivery_config = $10,
			recipient_emails = $11, recipient_user_ids = $12, webhook_url = $13,
			next_execution_at = $14, updated_at = $15
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query,
		schedule.ID, schedule.Name, schedule.CronExpression, schedule.Timezone,
		schedule.StartDate, schedule.EndDate, schedule.IsActive, schedule.Format,
		schedule.DeliveryMethod, deliveryConfigJSON, schedule.RecipientEmails,
		schedule.RecipientUserIDs, schedule.WebhookURL, schedule.NextExecutionAt, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to update schedule: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("schedule not found")
	}

	return nil
}

func (r *PostgresRepository) DeleteSchedule(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM report_schedules WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete schedule: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("schedule not found")
	}

	return nil
}

func (r *PostgresRepository) ListSchedules(ctx context.Context, filters *ScheduleFilters) ([]*ReportSchedule, int, error) {
	var conditions []string
	var args []interface{}
	argCount := 0

	if filters.ReportDefinitionID != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("report_definition_id = $%d", argCount))
		args = append(args, *filters.ReportDefinitionID)
	}

	if filters.IsActive != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", argCount))
		args = append(args, *filters.IsActive)
	}

	if filters.DeliveryMethod != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("delivery_method = $%d", argCount))
		args = append(args, *filters.DeliveryMethod)
	}

	if filters.CreatedBy != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("created_by = $%d", argCount))
		args = append(args, *filters.CreatedBy)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Get total count
	var totalCount int
	countQuery := `SELECT COUNT(*) FROM report_schedules` + whereClause
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count schedules: %w", err)
	}

	// Add pagination
	offset := (filters.Page - 1) * filters.PageSize
	if filters.Page < 1 {
		offset = 0
	}

	argCount++
	limitArg := argCount
	argCount++
	offsetArg := argCount

	query := `
		SELECT id, report_definition_id, name, cron_expression, timezone, start_date, end_date,
			   is_active, format, delivery_method, delivery_config, recipient_emails,
			   recipient_user_ids, webhook_url, last_executed_at, next_execution_at,
			   execution_count, created_by, created_at, updated_at
		FROM report_schedules
	` + whereClause + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", limitArg, offsetArg)
	args = append(args, filters.PageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list schedules: %w", err)
	}
	defer rows.Close()

	var schedules []*ReportSchedule
	for rows.Next() {
		var schedule ReportSchedule
		var deliveryConfigJSON []byte

		err := rows.Scan(
			&schedule.ID, &schedule.ReportDefinitionID, &schedule.Name, &schedule.CronExpression,
			&schedule.Timezone, &schedule.StartDate, &schedule.EndDate, &schedule.IsActive,
			&schedule.Format, &schedule.DeliveryMethod, &deliveryConfigJSON, &schedule.RecipientEmails,
			&schedule.RecipientUserIDs, &schedule.WebhookURL, &schedule.LastExecutedAt,
			&schedule.NextExecutionAt, &schedule.ExecutionCount, &schedule.CreatedBy,
			&schedule.CreatedAt, &schedule.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan schedule: %w", err)
		}

		if err := json.Unmarshal(deliveryConfigJSON, &schedule.DeliveryConfig); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal delivery config: %w", err)
		}

		schedules = append(schedules, &schedule)
	}

	return schedules, totalCount, nil
}

func (r *PostgresRepository) GetDueSchedules(ctx context.Context, limit int) ([]*ReportSchedule, error) {
	query := `
		SELECT id, report_definition_id, name, cron_expression, timezone, start_date, end_date,
			   is_active, format, delivery_method, delivery_config, recipient_emails,
			   recipient_user_ids, webhook_url, last_executed_at, next_execution_at,
			   execution_count, created_by, created_at, updated_at
		FROM report_schedules
		WHERE is_active = true
		  AND next_execution_at <= NOW()
		  AND (start_date IS NULL OR start_date <= CURRENT_DATE)
		  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
		ORDER BY next_execution_at ASC
		LIMIT $1
	`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get due schedules: %w", err)
	}
	defer rows.Close()

	var schedules []*ReportSchedule
	for rows.Next() {
		var schedule ReportSchedule
		var deliveryConfigJSON []byte

		err := rows.Scan(
			&schedule.ID, &schedule.ReportDefinitionID, &schedule.Name, &schedule.CronExpression,
			&schedule.Timezone, &schedule.StartDate, &schedule.EndDate, &schedule.IsActive,
			&schedule.Format, &schedule.DeliveryMethod, &deliveryConfigJSON, &schedule.RecipientEmails,
			&schedule.RecipientUserIDs, &schedule.WebhookURL, &schedule.LastExecutedAt,
			&schedule.NextExecutionAt, &schedule.ExecutionCount, &schedule.CreatedBy,
			&schedule.CreatedAt, &schedule.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan schedule: %w", err)
		}

		if err := json.Unmarshal(deliveryConfigJSON, &schedule.DeliveryConfig); err != nil {
			return nil, fmt.Errorf("failed to unmarshal delivery config: %w", err)
		}

		schedules = append(schedules, &schedule)
	}

	return schedules, nil
}

func (r *PostgresRepository) UpdateScheduleExecution(ctx context.Context, id uuid.UUID, lastExecuted, nextExecution time.Time) error {
	query := `
		UPDATE report_schedules SET
			last_executed_at = $2,
			next_execution_at = $3,
			execution_count = execution_count + 1,
			updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, id, lastExecuted, nextExecution)
	if err != nil {
		return fmt.Errorf("failed to update schedule execution: %w", err)
	}

	return nil
}

// =====================================================
// Report Executions
// =====================================================

func (r *PostgresRepository) CreateExecution(ctx context.Context, execution *ReportExecution) error {
	parametersJSON, _ := json.Marshal(execution.Parameters)
	deliveryStatusJSON, _ := json.Marshal(execution.DeliveryStatus)

	query := `
		INSERT INTO report_executions (
			id, report_definition_id, schedule_id, triggered_by, triggered_at, started_at,
			completed_at, status, error_message, record_count, file_size_bytes, file_key,
			download_url, download_url_expires_at, delivery_status, parameters, execution_log,
			duration_ms, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)
	`

	_, err := r.db.ExecContext(ctx, query,
		execution.ID, execution.ReportDefinitionID, execution.ScheduleID, execution.TriggeredBy,
		execution.TriggeredAt, execution.StartedAt, execution.CompletedAt, execution.Status,
		execution.ErrorMessage, execution.RecordCount, execution.FileSizeBytes, execution.FileKey,
		execution.DownloadURL, execution.DownloadURLExpiresAt, deliveryStatusJSON, parametersJSON,
		execution.ExecutionLog, execution.DurationMs, execution.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create execution: %w", err)
	}

	return nil
}

func (r *PostgresRepository) GetExecution(ctx context.Context, id uuid.UUID) (*ReportExecution, error) {
	query := `
		SELECT id, report_definition_id, schedule_id, triggered_by, triggered_at, started_at,
			   completed_at, status, error_message, record_count, file_size_bytes, file_key,
			   download_url, download_url_expires_at, delivery_status, parameters, execution_log,
			   duration_ms, created_at
		FROM report_executions
		WHERE id = $1
	`

	var execution ReportExecution
	var parametersJSON, deliveryStatusJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&execution.ID, &execution.ReportDefinitionID, &execution.ScheduleID, &execution.TriggeredBy,
		&execution.TriggeredAt, &execution.StartedAt, &execution.CompletedAt, &execution.Status,
		&execution.ErrorMessage, &execution.RecordCount, &execution.FileSizeBytes, &execution.FileKey,
		&execution.DownloadURL, &execution.DownloadURLExpiresAt, &deliveryStatusJSON, &parametersJSON,
		&execution.ExecutionLog, &execution.DurationMs, &execution.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("execution not found")
		}
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}

	if len(parametersJSON) > 0 {
		json.Unmarshal(parametersJSON, &execution.Parameters)
	}
	if len(deliveryStatusJSON) > 0 {
		json.Unmarshal(deliveryStatusJSON, &execution.DeliveryStatus)
	}

	return &execution, nil
}

func (r *PostgresRepository) UpdateExecution(ctx context.Context, execution *ReportExecution) error {
	deliveryStatusJSON, _ := json.Marshal(execution.DeliveryStatus)

	query := `
		UPDATE report_executions SET
			started_at = $2, completed_at = $3, status = $4, error_message = $5,
			record_count = $6, file_size_bytes = $7, file_key = $8, download_url = $9,
			download_url_expires_at = $10, delivery_status = $11, execution_log = $12, duration_ms = $13
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		execution.ID, execution.StartedAt, execution.CompletedAt, execution.Status,
		execution.ErrorMessage, execution.RecordCount, execution.FileSizeBytes, execution.FileKey,
		execution.DownloadURL, execution.DownloadURLExpiresAt, deliveryStatusJSON,
		execution.ExecutionLog, execution.DurationMs,
	)
	if err != nil {
		return fmt.Errorf("failed to update execution: %w", err)
	}

	return nil
}

func (r *PostgresRepository) ListExecutions(ctx context.Context, filters *ExecutionFilters) ([]*ReportExecution, int, error) {
	var conditions []string
	var args []interface{}
	argCount := 0

	if filters.ReportDefinitionID != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("report_definition_id = $%d", argCount))
		args = append(args, *filters.ReportDefinitionID)
	}

	if filters.ScheduleID != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("schedule_id = $%d", argCount))
		args = append(args, *filters.ScheduleID)
	}

	if filters.Status != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("status = $%d", argCount))
		args = append(args, *filters.Status)
	}

	if filters.TriggeredBy != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("triggered_by = $%d", argCount))
		args = append(args, *filters.TriggeredBy)
	}

	if filters.TriggeredAfter != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("triggered_at >= $%d", argCount))
		args = append(args, *filters.TriggeredAfter)
	}

	if filters.TriggeredBefore != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("triggered_at <= $%d", argCount))
		args = append(args, *filters.TriggeredBefore)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Get total count
	var totalCount int
	countQuery := `SELECT COUNT(*) FROM report_executions` + whereClause
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count executions: %w", err)
	}

	// Add pagination
	offset := (filters.Page - 1) * filters.PageSize
	if filters.Page < 1 {
		offset = 0
	}

	argCount++
	limitArg := argCount
	argCount++
	offsetArg := argCount

	query := `
		SELECT id, report_definition_id, schedule_id, triggered_by, triggered_at, started_at,
			   completed_at, status, error_message, record_count, file_size_bytes, file_key,
			   download_url, download_url_expires_at, delivery_status, parameters, execution_log,
			   duration_ms, created_at
		FROM report_executions
	` + whereClause + fmt.Sprintf(" ORDER BY triggered_at DESC LIMIT $%d OFFSET $%d", limitArg, offsetArg)
	args = append(args, filters.PageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list executions: %w", err)
	}
	defer rows.Close()

	var executions []*ReportExecution
	for rows.Next() {
		var execution ReportExecution
		var parametersJSON, deliveryStatusJSON []byte

		err := rows.Scan(
			&execution.ID, &execution.ReportDefinitionID, &execution.ScheduleID, &execution.TriggeredBy,
			&execution.TriggeredAt, &execution.StartedAt, &execution.CompletedAt, &execution.Status,
			&execution.ErrorMessage, &execution.RecordCount, &execution.FileSizeBytes, &execution.FileKey,
			&execution.DownloadURL, &execution.DownloadURLExpiresAt, &deliveryStatusJSON, &parametersJSON,
			&execution.ExecutionLog, &execution.DurationMs, &execution.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan execution: %w", err)
		}

		if len(parametersJSON) > 0 {
			json.Unmarshal(parametersJSON, &execution.Parameters)
		}
		if len(deliveryStatusJSON) > 0 {
			json.Unmarshal(deliveryStatusJSON, &execution.DeliveryStatus)
		}

		executions = append(executions, &execution)
	}

	return executions, totalCount, nil
}

func (r *PostgresRepository) GetPendingExecutions(ctx context.Context, limit int) ([]*ReportExecution, error) {
	query := `
		SELECT id, report_definition_id, schedule_id, triggered_by, triggered_at, started_at,
			   completed_at, status, error_message, record_count, file_size_bytes, file_key,
			   download_url, download_url_expires_at, delivery_status, parameters, execution_log,
			   duration_ms, created_at
		FROM report_executions
		WHERE status = 'pending'
		ORDER BY triggered_at ASC
		LIMIT $1
	`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending executions: %w", err)
	}
	defer rows.Close()

	var executions []*ReportExecution
	for rows.Next() {
		var execution ReportExecution
		var parametersJSON, deliveryStatusJSON []byte

		err := rows.Scan(
			&execution.ID, &execution.ReportDefinitionID, &execution.ScheduleID, &execution.TriggeredBy,
			&execution.TriggeredAt, &execution.StartedAt, &execution.CompletedAt, &execution.Status,
			&execution.ErrorMessage, &execution.RecordCount, &execution.FileSizeBytes, &execution.FileKey,
			&execution.DownloadURL, &execution.DownloadURLExpiresAt, &deliveryStatusJSON, &parametersJSON,
			&execution.ExecutionLog, &execution.DurationMs, &execution.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan execution: %w", err)
		}

		if len(parametersJSON) > 0 {
			json.Unmarshal(parametersJSON, &execution.Parameters)
		}
		if len(deliveryStatusJSON) > 0 {
			json.Unmarshal(deliveryStatusJSON, &execution.DeliveryStatus)
		}

		executions = append(executions, &execution)
	}

	return executions, nil
}

// =====================================================
// Benchmark Datasets
// =====================================================

func (r *PostgresRepository) CreateBenchmark(ctx context.Context, benchmark *BenchmarkDataset) error {
	dataJSON, _ := json.Marshal(benchmark.Data)
	statsJSON, _ := json.Marshal(benchmark.Statistics)

	query := `
		INSERT INTO benchmark_datasets (
			id, name, description, category, methodology, region, data, statistics,
			year, quarter, source, source_url, confidence_score, sample_size,
			data_collection_method, is_active, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)
	`

	_, err := r.db.ExecContext(ctx, query,
		benchmark.ID, benchmark.Name, benchmark.Description, benchmark.Category,
		benchmark.Methodology, benchmark.Region, dataJSON, statsJSON, benchmark.Year,
		benchmark.Quarter, benchmark.Source, benchmark.SourceURL, benchmark.ConfidenceScore,
		benchmark.SampleSize, benchmark.DataCollectionMethod, benchmark.IsActive,
		benchmark.CreatedBy, benchmark.CreatedAt, benchmark.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create benchmark: %w", err)
	}

	return nil
}

func (r *PostgresRepository) GetBenchmark(ctx context.Context, id uuid.UUID) (*BenchmarkDataset, error) {
	query := `
		SELECT id, name, description, category, methodology, region, data, statistics,
			   year, quarter, source, source_url, confidence_score, sample_size,
			   data_collection_method, is_active, created_by, created_at, updated_at
		FROM benchmark_datasets
		WHERE id = $1
	`

	var benchmark BenchmarkDataset
	var dataJSON, statsJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&benchmark.ID, &benchmark.Name, &benchmark.Description, &benchmark.Category,
		&benchmark.Methodology, &benchmark.Region, &dataJSON, &statsJSON, &benchmark.Year,
		&benchmark.Quarter, &benchmark.Source, &benchmark.SourceURL, &benchmark.ConfidenceScore,
		&benchmark.SampleSize, &benchmark.DataCollectionMethod, &benchmark.IsActive,
		&benchmark.CreatedBy, &benchmark.CreatedAt, &benchmark.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("benchmark not found")
		}
		return nil, fmt.Errorf("failed to get benchmark: %w", err)
	}

	if len(dataJSON) > 0 {
		json.Unmarshal(dataJSON, &benchmark.Data)
	}
	if len(statsJSON) > 0 {
		json.Unmarshal(statsJSON, &benchmark.Statistics)
	}

	return &benchmark, nil
}

func (r *PostgresRepository) UpdateBenchmark(ctx context.Context, benchmark *BenchmarkDataset) error {
	dataJSON, _ := json.Marshal(benchmark.Data)
	statsJSON, _ := json.Marshal(benchmark.Statistics)

	query := `
		UPDATE benchmark_datasets SET
			name = $2, description = $3, category = $4, methodology = $5, region = $6,
			data = $7, statistics = $8, year = $9, quarter = $10, source = $11,
			source_url = $12, confidence_score = $13, sample_size = $14,
			data_collection_method = $15, is_active = $16, updated_at = $17
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		benchmark.ID, benchmark.Name, benchmark.Description, benchmark.Category,
		benchmark.Methodology, benchmark.Region, dataJSON, statsJSON, benchmark.Year,
		benchmark.Quarter, benchmark.Source, benchmark.SourceURL, benchmark.ConfidenceScore,
		benchmark.SampleSize, benchmark.DataCollectionMethod, benchmark.IsActive, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to update benchmark: %w", err)
	}

	return nil
}

func (r *PostgresRepository) DeleteBenchmark(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM benchmark_datasets WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete benchmark: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("benchmark not found")
	}

	return nil
}

func (r *PostgresRepository) ListBenchmarks(ctx context.Context, filters *BenchmarkFilters) ([]*BenchmarkDataset, int, error) {
	var conditions []string
	var args []interface{}
	argCount := 0

	if filters.Category != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("category = $%d", argCount))
		args = append(args, *filters.Category)
	}

	if filters.Methodology != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("methodology = $%d", argCount))
		args = append(args, *filters.Methodology)
	}

	if filters.Region != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("region = $%d", argCount))
		args = append(args, *filters.Region)
	}

	if filters.Year != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("year = $%d", argCount))
		args = append(args, *filters.Year)
	}

	if filters.IsActive != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", argCount))
		args = append(args, *filters.IsActive)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Get total count
	var totalCount int
	countQuery := `SELECT COUNT(*) FROM benchmark_datasets` + whereClause
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count benchmarks: %w", err)
	}

	// Add pagination
	offset := (filters.Page - 1) * filters.PageSize
	if filters.Page < 1 {
		offset = 0
	}

	argCount++
	limitArg := argCount
	argCount++
	offsetArg := argCount

	query := `
		SELECT id, name, description, category, methodology, region, data, statistics,
			   year, quarter, source, source_url, confidence_score, sample_size,
			   data_collection_method, is_active, created_by, created_at, updated_at
		FROM benchmark_datasets
	` + whereClause + fmt.Sprintf(" ORDER BY year DESC, created_at DESC LIMIT $%d OFFSET $%d", limitArg, offsetArg)
	args = append(args, filters.PageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list benchmarks: %w", err)
	}
	defer rows.Close()

	var benchmarks []*BenchmarkDataset
	for rows.Next() {
		var benchmark BenchmarkDataset
		var dataJSON, statsJSON []byte

		err := rows.Scan(
			&benchmark.ID, &benchmark.Name, &benchmark.Description, &benchmark.Category,
			&benchmark.Methodology, &benchmark.Region, &dataJSON, &statsJSON, &benchmark.Year,
			&benchmark.Quarter, &benchmark.Source, &benchmark.SourceURL, &benchmark.ConfidenceScore,
			&benchmark.SampleSize, &benchmark.DataCollectionMethod, &benchmark.IsActive,
			&benchmark.CreatedBy, &benchmark.CreatedAt, &benchmark.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan benchmark: %w", err)
		}

		if len(dataJSON) > 0 {
			json.Unmarshal(dataJSON, &benchmark.Data)
		}
		if len(statsJSON) > 0 {
			json.Unmarshal(statsJSON, &benchmark.Statistics)
		}

		benchmarks = append(benchmarks, &benchmark)
	}

	return benchmarks, totalCount, nil
}

func (r *PostgresRepository) GetBenchmarksByCategory(ctx context.Context, category BenchmarkCategory, methodology, region *string, year *int) ([]*BenchmarkDataset, error) {
	var conditions []string
	var args []interface{}
	argCount := 1

	conditions = append(conditions, fmt.Sprintf("category = $%d", argCount))
	args = append(args, category)

	conditions = append(conditions, "is_active = true")

	if methodology != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("methodology = $%d", argCount))
		args = append(args, *methodology)
	}

	if region != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("region = $%d", argCount))
		args = append(args, *region)
	}

	if year != nil {
		argCount++
		conditions = append(conditions, fmt.Sprintf("year = $%d", argCount))
		args = append(args, *year)
	}

	query := `
		SELECT id, name, description, category, methodology, region, data, statistics,
			   year, quarter, source, source_url, confidence_score, sample_size,
			   data_collection_method, is_active, created_by, created_at, updated_at
		FROM benchmark_datasets
		WHERE ` + strings.Join(conditions, " AND ") + `
		ORDER BY year DESC, confidence_score DESC
	`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get benchmarks by category: %w", err)
	}
	defer rows.Close()

	var benchmarks []*BenchmarkDataset
	for rows.Next() {
		var benchmark BenchmarkDataset
		var dataJSON, statsJSON []byte

		err := rows.Scan(
			&benchmark.ID, &benchmark.Name, &benchmark.Description, &benchmark.Category,
			&benchmark.Methodology, &benchmark.Region, &dataJSON, &statsJSON, &benchmark.Year,
			&benchmark.Quarter, &benchmark.Source, &benchmark.SourceURL, &benchmark.ConfidenceScore,
			&benchmark.SampleSize, &benchmark.DataCollectionMethod, &benchmark.IsActive,
			&benchmark.CreatedBy, &benchmark.CreatedAt, &benchmark.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan benchmark: %w", err)
		}

		if len(dataJSON) > 0 {
			json.Unmarshal(dataJSON, &benchmark.Data)
		}
		if len(statsJSON) > 0 {
			json.Unmarshal(statsJSON, &benchmark.Statistics)
		}

		benchmarks = append(benchmarks, &benchmark)
	}

	return benchmarks, nil
}

// =====================================================
// Dashboard Widgets
// =====================================================

func (r *PostgresRepository) CreateWidget(ctx context.Context, widget *DashboardWidget) error {
	configJSON, _ := json.Marshal(widget.Config)
	cachedDataJSON, _ := json.Marshal(widget.CachedData)

	query := `
		INSERT INTO dashboard_widgets (
			id, user_id, dashboard_section, widget_type, title, subtitle, config,
			size, position, row_span, col_span, refresh_interval_seconds,
			last_refreshed_at, cached_data, is_visible, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
		)
	`

	_, err := r.db.ExecContext(ctx, query,
		widget.ID, widget.UserID, widget.DashboardSection, widget.WidgetType,
		widget.Title, widget.Subtitle, configJSON, widget.Size, widget.Position,
		widget.RowSpan, widget.ColSpan, widget.RefreshIntervalSeconds,
		widget.LastRefreshedAt, cachedDataJSON, widget.IsVisible,
		widget.CreatedAt, widget.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create widget: %w", err)
	}

	return nil
}

func (r *PostgresRepository) GetWidget(ctx context.Context, id uuid.UUID) (*DashboardWidget, error) {
	query := `
		SELECT id, user_id, dashboard_section, widget_type, title, subtitle, config,
			   size, position, row_span, col_span, refresh_interval_seconds,
			   last_refreshed_at, cached_data, is_visible, created_at, updated_at
		FROM dashboard_widgets
		WHERE id = $1
	`

	var widget DashboardWidget
	var configJSON, cachedDataJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&widget.ID, &widget.UserID, &widget.DashboardSection, &widget.WidgetType,
		&widget.Title, &widget.Subtitle, &configJSON, &widget.Size, &widget.Position,
		&widget.RowSpan, &widget.ColSpan, &widget.RefreshIntervalSeconds,
		&widget.LastRefreshedAt, &cachedDataJSON, &widget.IsVisible,
		&widget.CreatedAt, &widget.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("widget not found")
		}
		return nil, fmt.Errorf("failed to get widget: %w", err)
	}

	if len(configJSON) > 0 {
		json.Unmarshal(configJSON, &widget.Config)
	}
	if len(cachedDataJSON) > 0 {
		json.Unmarshal(cachedDataJSON, &widget.CachedData)
	}

	return &widget, nil
}

func (r *PostgresRepository) UpdateWidget(ctx context.Context, widget *DashboardWidget) error {
	configJSON, _ := json.Marshal(widget.Config)

	query := `
		UPDATE dashboard_widgets SET
			dashboard_section = $2, widget_type = $3, title = $4, subtitle = $5,
			config = $6, size = $7, position = $8, row_span = $9, col_span = $10,
			refresh_interval_seconds = $11, is_visible = $12, updated_at = $13
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		widget.ID, widget.DashboardSection, widget.WidgetType, widget.Title,
		widget.Subtitle, configJSON, widget.Size, widget.Position, widget.RowSpan,
		widget.ColSpan, widget.RefreshIntervalSeconds, widget.IsVisible, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to update widget: %w", err)
	}

	return nil
}

func (r *PostgresRepository) DeleteWidget(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM dashboard_widgets WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete widget: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("widget not found")
	}

	return nil
}

func (r *PostgresRepository) GetUserWidgets(ctx context.Context, userID uuid.UUID, section *string) ([]*DashboardWidget, error) {
	var args []interface{}
	args = append(args, userID)

	query := `
		SELECT id, user_id, dashboard_section, widget_type, title, subtitle, config,
			   size, position, row_span, col_span, refresh_interval_seconds,
			   last_refreshed_at, cached_data, is_visible, created_at, updated_at
		FROM dashboard_widgets
		WHERE user_id = $1 AND is_visible = true
	`

	if section != nil {
		query += " AND dashboard_section = $2"
		args = append(args, *section)
	}

	query += " ORDER BY dashboard_section, position"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get user widgets: %w", err)
	}
	defer rows.Close()

	var widgets []*DashboardWidget
	for rows.Next() {
		var widget DashboardWidget
		var configJSON, cachedDataJSON []byte

		err := rows.Scan(
			&widget.ID, &widget.UserID, &widget.DashboardSection, &widget.WidgetType,
			&widget.Title, &widget.Subtitle, &configJSON, &widget.Size, &widget.Position,
			&widget.RowSpan, &widget.ColSpan, &widget.RefreshIntervalSeconds,
			&widget.LastRefreshedAt, &cachedDataJSON, &widget.IsVisible,
			&widget.CreatedAt, &widget.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan widget: %w", err)
		}

		if len(configJSON) > 0 {
			json.Unmarshal(configJSON, &widget.Config)
		}
		if len(cachedDataJSON) > 0 {
			json.Unmarshal(cachedDataJSON, &widget.CachedData)
		}

		widgets = append(widgets, &widget)
	}

	return widgets, nil
}

func (r *PostgresRepository) UpdateWidgetCache(ctx context.Context, id uuid.UUID, data JSONB) error {
	dataJSON, _ := json.Marshal(data)

	query := `
		UPDATE dashboard_widgets SET
			cached_data = $2,
			last_refreshed_at = NOW(),
			updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, id, dataJSON)
	if err != nil {
		return fmt.Errorf("failed to update widget cache: %w", err)
	}

	return nil
}

// =====================================================
// Dashboard Aggregates
// =====================================================

func (r *PostgresRepository) GetAggregate(ctx context.Context, key string) (*DashboardAggregate, error) {
	query := `
		SELECT id, aggregate_key, aggregate_type, project_id, user_id, organization_id,
			   period_type, period_start, period_end, data, source_record_count,
			   last_source_update_at, computed_at, is_stale, created_at, updated_at
		FROM dashboard_aggregates
		WHERE aggregate_key = $1
	`

	var aggregate DashboardAggregate
	var dataJSON []byte

	err := r.db.QueryRowContext(ctx, query, key).Scan(
		&aggregate.ID, &aggregate.AggregateKey, &aggregate.AggregateType,
		&aggregate.ProjectID, &aggregate.UserID, &aggregate.OrganizationID,
		&aggregate.PeriodType, &aggregate.PeriodStart, &aggregate.PeriodEnd,
		&dataJSON, &aggregate.SourceRecordCount, &aggregate.LastSourceUpdateAt,
		&aggregate.ComputedAt, &aggregate.IsStale, &aggregate.CreatedAt, &aggregate.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found is not an error for aggregates
		}
		return nil, fmt.Errorf("failed to get aggregate: %w", err)
	}

	if len(dataJSON) > 0 {
		json.Unmarshal(dataJSON, &aggregate.Data)
	}

	return &aggregate, nil
}

func (r *PostgresRepository) UpsertAggregate(ctx context.Context, aggregate *DashboardAggregate) error {
	dataJSON, _ := json.Marshal(aggregate.Data)

	query := `
		INSERT INTO dashboard_aggregates (
			id, aggregate_key, aggregate_type, project_id, user_id, organization_id,
			period_type, period_start, period_end, data, source_record_count,
			last_source_update_at, computed_at, is_stale, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		ON CONFLICT (aggregate_key) DO UPDATE SET
			data = EXCLUDED.data,
			source_record_count = EXCLUDED.source_record_count,
			last_source_update_at = EXCLUDED.last_source_update_at,
			computed_at = EXCLUDED.computed_at,
			is_stale = EXCLUDED.is_stale,
			updated_at = NOW()
	`

	_, err := r.db.ExecContext(ctx, query,
		aggregate.ID, aggregate.AggregateKey, aggregate.AggregateType,
		aggregate.ProjectID, aggregate.UserID, aggregate.OrganizationID,
		aggregate.PeriodType, aggregate.PeriodStart, aggregate.PeriodEnd,
		dataJSON, aggregate.SourceRecordCount, aggregate.LastSourceUpdateAt,
		aggregate.ComputedAt, aggregate.IsStale, aggregate.CreatedAt, aggregate.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert aggregate: %w", err)
	}

	return nil
}

func (r *PostgresRepository) GetStaleAggregates(ctx context.Context, limit int) ([]*DashboardAggregate, error) {
	query := `
		SELECT id, aggregate_key, aggregate_type, project_id, user_id, organization_id,
			   period_type, period_start, period_end, data, source_record_count,
			   last_source_update_at, computed_at, is_stale, created_at, updated_at
		FROM dashboard_aggregates
		WHERE is_stale = true
		ORDER BY computed_at ASC
		LIMIT $1
	`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get stale aggregates: %w", err)
	}
	defer rows.Close()

	var aggregates []*DashboardAggregate
	for rows.Next() {
		var aggregate DashboardAggregate
		var dataJSON []byte

		err := rows.Scan(
			&aggregate.ID, &aggregate.AggregateKey, &aggregate.AggregateType,
			&aggregate.ProjectID, &aggregate.UserID, &aggregate.OrganizationID,
			&aggregate.PeriodType, &aggregate.PeriodStart, &aggregate.PeriodEnd,
			&dataJSON, &aggregate.SourceRecordCount, &aggregate.LastSourceUpdateAt,
			&aggregate.ComputedAt, &aggregate.IsStale, &aggregate.CreatedAt, &aggregate.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan aggregate: %w", err)
		}

		if len(dataJSON) > 0 {
			json.Unmarshal(dataJSON, &aggregate.Data)
		}

		aggregates = append(aggregates, &aggregate)
	}

	return aggregates, nil
}

func (r *PostgresRepository) MarkAggregatesStale(ctx context.Context, aggregateType string, projectID *uuid.UUID) error {
	var args []interface{}
	args = append(args, aggregateType)

	query := `UPDATE dashboard_aggregates SET is_stale = true, updated_at = NOW() WHERE aggregate_type = $1`

	if projectID != nil {
		query += " AND project_id = $2"
		args = append(args, *projectID)
	}

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to mark aggregates stale: %w", err)
	}

	return nil
}

// =====================================================
// Data Sources
// =====================================================

func (r *PostgresRepository) GetDataSources(ctx context.Context) ([]*ReportDataSource, error) {
	query := `
		SELECT id, name, display_name, description, schema_definition, source_type,
			   source_config, required_permissions, supports_streaming, max_records,
			   estimated_row_count, is_active, created_at, updated_at
		FROM report_data_sources
		WHERE is_active = true
		ORDER BY display_name
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get data sources: %w", err)
	}
	defer rows.Close()

	var sources []*ReportDataSource
	for rows.Next() {
		var source ReportDataSource
		var schemaJSON, configJSON []byte

		err := rows.Scan(
			&source.ID, &source.Name, &source.DisplayName, &source.Description,
			&schemaJSON, &source.SourceType, &configJSON, &source.RequiredPermissions,
			&source.SupportsStreaming, &source.MaxRecords, &source.EstimatedRowCount,
			&source.IsActive, &source.CreatedAt, &source.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan data source: %w", err)
		}

		if len(schemaJSON) > 0 {
			json.Unmarshal(schemaJSON, &source.SchemaDefinition)
		}
		if len(configJSON) > 0 {
			json.Unmarshal(configJSON, &source.SourceConfig)
		}

		sources = append(sources, &source)
	}

	return sources, nil
}

func (r *PostgresRepository) GetDataSource(ctx context.Context, name string) (*ReportDataSource, error) {
	query := `
		SELECT id, name, display_name, description, schema_definition, source_type,
			   source_config, required_permissions, supports_streaming, max_records,
			   estimated_row_count, is_active, created_at, updated_at
		FROM report_data_sources
		WHERE name = $1 AND is_active = true
	`

	var source ReportDataSource
	var schemaJSON, configJSON []byte

	err := r.db.QueryRowContext(ctx, query, name).Scan(
		&source.ID, &source.Name, &source.DisplayName, &source.Description,
		&schemaJSON, &source.SourceType, &configJSON, &source.RequiredPermissions,
		&source.SupportsStreaming, &source.MaxRecords, &source.EstimatedRowCount,
		&source.IsActive, &source.CreatedAt, &source.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("data source not found")
		}
		return nil, fmt.Errorf("failed to get data source: %w", err)
	}

	if len(schemaJSON) > 0 {
		json.Unmarshal(schemaJSON, &source.SchemaDefinition)
	}
	if len(configJSON) > 0 {
		json.Unmarshal(configJSON, &source.SourceConfig)
	}

	return &source, nil
}

// =====================================================
// Dynamic Query Execution
// =====================================================

func (r *PostgresRepository) ExecuteReportQuery(ctx context.Context, config *ReportConfig, params map[string]interface{}) ([]map[string]interface{}, int, error) {
	// This is a simplified implementation - in production, use a proper query builder
	// with SQL injection prevention

	// Get the data source to determine the table
	source, err := r.GetDataSource(ctx, config.Dataset)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid dataset: %w", err)
	}

	sourceConfig, ok := source.SourceConfig["table"].(string)
	if !ok {
		return nil, 0, fmt.Errorf("invalid source configuration")
	}

	// Build SELECT clause
	var selectFields []string
	for _, field := range config.Fields {
		if !field.IsVisible {
			continue
		}
		fieldExpr := field.Name
		if field.Aggregate != nil {
			fieldExpr = fmt.Sprintf("%s(%s)", *field.Aggregate, field.Name)
		}
		if field.Alias != "" {
			fieldExpr += " AS " + field.Alias
		}
		selectFields = append(selectFields, fieldExpr)
	}

	if len(selectFields) == 0 {
		selectFields = append(selectFields, "*")
	}

	// Build basic query
	query := fmt.Sprintf("SELECT %s FROM %s", strings.Join(selectFields, ", "), sourceConfig)

	// Build WHERE clause (simplified - needs proper parameterization)
	var conditions []string
	var args []interface{}
	argCount := 0

	for _, filter := range config.Filters {
		argCount++
		condition := buildFilterCondition(filter, argCount)
		if condition != "" {
			conditions = append(conditions, condition)
			args = append(args, filter.Value)
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// Build GROUP BY clause
	if len(config.Groupings) > 0 {
		var groupFields []string
		for _, g := range config.Groupings {
			groupFields = append(groupFields, g.Field)
		}
		query += " GROUP BY " + strings.Join(groupFields, ", ")
	}

	// Build ORDER BY clause
	if len(config.Sorts) > 0 {
		var sortFields []string
		for _, s := range config.Sorts {
			sortFields = append(sortFields, fmt.Sprintf("%s %s", s.Field, strings.ToUpper(s.Direction)))
		}
		query += " ORDER BY " + strings.Join(sortFields, ", ")
	}

	// Get total count (without LIMIT)
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM (%s) AS count_query", query)
	var totalCount int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		// If count fails, continue without it
		totalCount = -1
	}

	// Add LIMIT
	if config.Limit != nil && *config.Limit > 0 {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, *config.Limit)
	}

	// Execute query
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute report query: %w", err)
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get columns: %w", err)
	}

	// Build results
	var results []map[string]interface{}
	for rows.Next() {
		// Create a slice of interface{}'s to represent each column
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, 0, fmt.Errorf("failed to scan row: %w", err)
		}

		// Build map for this row
		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}

	if totalCount < 0 {
		totalCount = len(results)
	}

	return results, totalCount, nil
}

// buildFilterCondition builds a SQL condition for a filter
func buildFilterCondition(filter ReportFilter, argNum int) string {
	placeholder := fmt.Sprintf("$%d", argNum)

	switch filter.Operator {
	case FilterOperatorEquals:
		return fmt.Sprintf("%s = %s", filter.Field, placeholder)
	case FilterOperatorNotEquals:
		return fmt.Sprintf("%s != %s", filter.Field, placeholder)
	case FilterOperatorGreaterThan:
		return fmt.Sprintf("%s > %s", filter.Field, placeholder)
	case FilterOperatorGreaterThanEqual:
		return fmt.Sprintf("%s >= %s", filter.Field, placeholder)
	case FilterOperatorLessThan:
		return fmt.Sprintf("%s < %s", filter.Field, placeholder)
	case FilterOperatorLessThanEqual:
		return fmt.Sprintf("%s <= %s", filter.Field, placeholder)
	case FilterOperatorContains:
		return fmt.Sprintf("%s ILIKE '%%' || %s || '%%'", filter.Field, placeholder)
	case FilterOperatorStartsWith:
		return fmt.Sprintf("%s ILIKE %s || '%%'", filter.Field, placeholder)
	case FilterOperatorEndsWith:
		return fmt.Sprintf("%s ILIKE '%%' || %s", filter.Field, placeholder)
	case FilterOperatorIn:
		return fmt.Sprintf("%s = ANY(%s)", filter.Field, placeholder)
	case FilterOperatorNotIn:
		return fmt.Sprintf("%s != ALL(%s)", filter.Field, placeholder)
	case FilterOperatorIsNull:
		return fmt.Sprintf("%s IS NULL", filter.Field)
	case FilterOperatorIsNotNull:
		return fmt.Sprintf("%s IS NOT NULL", filter.Field)
	default:
		return ""
	}
}
