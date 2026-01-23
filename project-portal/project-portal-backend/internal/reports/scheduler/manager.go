package scheduler

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// ScheduleManager manages scheduled report execution
type ScheduleManager struct {
	cron       *cron.Cron
	jobs       map[uuid.UUID]cron.EntryID
	executor   *Executor
	repository ScheduleRepository
	logger     *zap.Logger
	mu         sync.RWMutex
	running    bool
}

// ScheduleRepository interface for schedule data access
type ScheduleRepository interface {
	GetDueSchedules(ctx context.Context, limit int) ([]*Schedule, error)
	UpdateScheduleExecution(ctx context.Context, id uuid.UUID, lastExecuted, nextExecution time.Time) error
	GetSchedule(ctx context.Context, id uuid.UUID) (*Schedule, error)
}

// Schedule represents a scheduled report
type Schedule struct {
	ID                 uuid.UUID         `json:"id"`
	ReportDefinitionID uuid.UUID         `json:"report_definition_id"`
	Name               string            `json:"name"`
	CronExpression     string            `json:"cron_expression"`
	Timezone           string            `json:"timezone"`
	StartDate          *time.Time        `json:"start_date,omitempty"`
	EndDate            *time.Time        `json:"end_date,omitempty"`
	IsActive           bool              `json:"is_active"`
	Format             string            `json:"format"`
	DeliveryMethod     string            `json:"delivery_method"`
	DeliveryConfig     map[string]any    `json:"delivery_config"`
	RecipientEmails    []string          `json:"recipient_emails,omitempty"`
	RecipientUserIDs   []uuid.UUID       `json:"recipient_user_ids,omitempty"`
	WebhookURL         *string           `json:"webhook_url,omitempty"`
	LastExecutedAt     *time.Time        `json:"last_executed_at,omitempty"`
	NextExecutionAt    *time.Time        `json:"next_execution_at,omitempty"`
	ExecutionCount     int               `json:"execution_count"`
}

// ScheduleManagerConfig configuration for the schedule manager
type ScheduleManagerConfig struct {
	PollInterval    time.Duration `json:"poll_interval"`
	MaxConcurrent   int           `json:"max_concurrent"`
	RetryAttempts   int           `json:"retry_attempts"`
	RetryDelay      time.Duration `json:"retry_delay"`
}

// DefaultScheduleManagerConfig returns default configuration
func DefaultScheduleManagerConfig() ScheduleManagerConfig {
	return ScheduleManagerConfig{
		PollInterval:  time.Minute,
		MaxConcurrent: 10,
		RetryAttempts: 3,
		RetryDelay:    time.Minute * 5,
	}
}

// NewScheduleManager creates a new schedule manager
func NewScheduleManager(
	executor *Executor,
	repository ScheduleRepository,
	logger *zap.Logger,
	config ScheduleManagerConfig,
) *ScheduleManager {
	return &ScheduleManager{
		cron:       cron.New(cron.WithSeconds()),
		jobs:       make(map[uuid.UUID]cron.EntryID),
		executor:   executor,
		repository: repository,
		logger:     logger,
	}
}

// Start starts the schedule manager
func (m *ScheduleManager) Start(ctx context.Context) error {
	m.mu.Lock()
	if m.running {
		m.mu.Unlock()
		return fmt.Errorf("schedule manager already running")
	}
	m.running = true
	m.mu.Unlock()

	m.logger.Info("Starting schedule manager")

	// Start the cron scheduler
	m.cron.Start()

	// Start the poll loop for due schedules
	go m.pollLoop(ctx)

	return nil
}

// Stop stops the schedule manager
func (m *ScheduleManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return
	}

	m.logger.Info("Stopping schedule manager")

	// Stop the cron scheduler
	ctx := m.cron.Stop()
	<-ctx.Done()

	m.running = false
}

// pollLoop polls for due schedules and executes them
func (m *ScheduleManager) pollLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	// Initial poll
	m.pollAndExecute(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.pollAndExecute(ctx)
		}
	}
}

// pollAndExecute polls for due schedules and executes them
func (m *ScheduleManager) pollAndExecute(ctx context.Context) {
	schedules, err := m.repository.GetDueSchedules(ctx, 10)
	if err != nil {
		m.logger.Error("Failed to get due schedules", zap.Error(err))
		return
	}

	for _, schedule := range schedules {
		go m.executeSchedule(ctx, schedule)
	}
}

// executeSchedule executes a single scheduled report
func (m *ScheduleManager) executeSchedule(ctx context.Context, schedule *Schedule) {
	m.logger.Info("Executing scheduled report",
		zap.String("schedule_id", schedule.ID.String()),
		zap.String("schedule_name", schedule.Name))

	// Execute the report
	result, err := m.executor.Execute(ctx, &ExecutionRequest{
		ReportDefinitionID: schedule.ReportDefinitionID,
		ScheduleID:         &schedule.ID,
		Format:             schedule.Format,
		DeliveryMethod:     schedule.DeliveryMethod,
		DeliveryConfig:     schedule.DeliveryConfig,
		RecipientEmails:    schedule.RecipientEmails,
		WebhookURL:         schedule.WebhookURL,
	})

	if err != nil {
		m.logger.Error("Failed to execute scheduled report",
			zap.String("schedule_id", schedule.ID.String()),
			zap.Error(err))
		return
	}

	// Calculate next execution time
	nextExecution := m.calculateNextExecution(schedule.CronExpression, schedule.Timezone)

	// Update schedule execution
	if err := m.repository.UpdateScheduleExecution(ctx, schedule.ID, time.Now(), nextExecution); err != nil {
		m.logger.Error("Failed to update schedule execution",
			zap.String("schedule_id", schedule.ID.String()),
			zap.Error(err))
	}

	m.logger.Info("Scheduled report execution completed",
		zap.String("schedule_id", schedule.ID.String()),
		zap.String("execution_id", result.ExecutionID.String()),
		zap.Time("next_execution", nextExecution))
}

// calculateNextExecution calculates the next execution time for a cron expression
func (m *ScheduleManager) calculateNextExecution(cronExpr, timezone string) time.Time {
	// Parse timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	// Parse cron expression
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		// Default to 1 hour from now if parsing fails
		return time.Now().In(loc).Add(time.Hour)
	}

	// Get next execution time
	return schedule.Next(time.Now().In(loc))
}

// AddSchedule adds a new schedule to the manager
func (m *ScheduleManager) AddSchedule(schedule *Schedule) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Remove existing job if any
	if entryID, ok := m.jobs[schedule.ID]; ok {
		m.cron.Remove(entryID)
	}

	// Parse timezone
	loc, err := time.LoadLocation(schedule.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Add new cron job
	entryID, err := m.cron.AddFunc(schedule.CronExpression, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		m.executeSchedule(ctx, schedule)
	})

	if err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	m.jobs[schedule.ID] = entryID

	m.logger.Info("Added schedule",
		zap.String("schedule_id", schedule.ID.String()),
		zap.String("cron", schedule.CronExpression),
		zap.String("timezone", loc.String()))

	return nil
}

// RemoveSchedule removes a schedule from the manager
func (m *ScheduleManager) RemoveSchedule(scheduleID uuid.UUID) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if entryID, ok := m.jobs[scheduleID]; ok {
		m.cron.Remove(entryID)
		delete(m.jobs, scheduleID)

		m.logger.Info("Removed schedule", zap.String("schedule_id", scheduleID.String()))
	}
}

// UpdateSchedule updates an existing schedule
func (m *ScheduleManager) UpdateSchedule(schedule *Schedule) error {
	// Simply remove and re-add
	m.RemoveSchedule(schedule.ID)

	if schedule.IsActive {
		return m.AddSchedule(schedule)
	}

	return nil
}

// GetActiveJobs returns the number of active jobs
func (m *ScheduleManager) GetActiveJobs() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.jobs)
}

// GetJobStatus returns the status of a scheduled job
func (m *ScheduleManager) GetJobStatus(scheduleID uuid.UUID) (*JobStatus, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	entryID, ok := m.jobs[scheduleID]
	if !ok {
		return nil, fmt.Errorf("job not found")
	}

	entry := m.cron.Entry(entryID)
	return &JobStatus{
		ScheduleID:    scheduleID,
		NextRun:       entry.Next,
		PrevRun:       entry.Prev,
		IsActive:      true,
	}, nil
}

// JobStatus represents the status of a scheduled job
type JobStatus struct {
	ScheduleID    uuid.UUID `json:"schedule_id"`
	NextRun       time.Time `json:"next_run"`
	PrevRun       time.Time `json:"prev_run"`
	IsActive      bool      `json:"is_active"`
}

// ValidateCronExpression validates a cron expression
func ValidateCronExpression(expr string) error {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expr)
	return err
}

// DescribeCronExpression returns a human-readable description of a cron expression
func DescribeCronExpression(expr string) string {
	// Simple descriptions for common patterns
	switch expr {
	case "0 * * * *":
		return "Every hour"
	case "0 0 * * *":
		return "Every day at midnight"
	case "0 0 * * 0":
		return "Every Sunday at midnight"
	case "0 0 1 * *":
		return "First day of every month at midnight"
	case "0 9 * * 1-5":
		return "Every weekday at 9:00 AM"
	default:
		return expr
	}
}
