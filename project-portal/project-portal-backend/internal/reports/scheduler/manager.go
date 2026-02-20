package scheduler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

// Manager handles scheduled report execution
type Manager struct {
	cron          *cron.Cron
	executor      ReportExecutor
	repository    ScheduleRepository
	jobs          map[uuid.UUID]cron.EntryID
	mu            sync.RWMutex
	workerPool    chan struct{}
	maxConcurrent int
}

// ReportExecutor defines the interface for executing reports
type ReportExecutor interface {
	ExecuteScheduledReport(ctx context.Context, scheduleID uuid.UUID) error
}

// ScheduleRepository defines the interface for schedule data access
type ScheduleRepository interface {
	GetActiveSchedules(ctx context.Context) ([]Schedule, error)
	GetSchedule(ctx context.Context, id uuid.UUID) (*Schedule, error)
	UpdateLastRun(ctx context.Context, id uuid.UUID, runTime time.Time) error
	UpdateNextRun(ctx context.Context, id uuid.UUID, nextTime time.Time) error
}

// Schedule represents a scheduled report configuration
type Schedule struct {
	ID                 uuid.UUID   `json:"id"`
	ReportDefinitionID uuid.UUID   `json:"report_definition_id"`
	Name               string      `json:"name"`
	CronExpression     string      `json:"cron_expression"`
	Timezone           string      `json:"timezone"`
	StartDate          *time.Time  `json:"start_date"`
	EndDate            *time.Time  `json:"end_date"`
	IsActive           bool        `json:"is_active"`
	Format             string      `json:"format"`
	DeliveryMethod     string      `json:"delivery_method"`
	DeliveryConfig     interface{} `json:"delivery_config"`
	RecipientEmails    []string    `json:"recipient_emails"`
	RecipientUserIDs   []uuid.UUID `json:"recipient_user_ids"`
	WebhookURL         string      `json:"webhook_url"`
	LastRunAt          *time.Time  `json:"last_run_at"`
	NextRunAt          *time.Time  `json:"next_run_at"`
}

// ManagerConfig holds scheduler configuration
type ManagerConfig struct {
	MaxConcurrentJobs int
	JobTimeout        time.Duration
	RetryAttempts     int
	RetryDelay        time.Duration
}

// DefaultConfig returns default scheduler configuration
func DefaultConfig() ManagerConfig {
	return ManagerConfig{
		MaxConcurrentJobs: 10,
		JobTimeout:        30 * time.Minute,
		RetryAttempts:     3,
		RetryDelay:        5 * time.Minute,
	}
}

// NewManager creates a new scheduler manager
func NewManager(executor ReportExecutor, repository ScheduleRepository, config ManagerConfig) *Manager {
	return &Manager{
		cron:          cron.New(cron.WithSeconds(), cron.WithLocation(time.UTC)),
		executor:      executor,
		repository:    repository,
		jobs:          make(map[uuid.UUID]cron.EntryID),
		workerPool:    make(chan struct{}, config.MaxConcurrentJobs),
		maxConcurrent: config.MaxConcurrentJobs,
	}
}

// Start begins the scheduler
func (m *Manager) Start(ctx context.Context) error {
	// Load existing schedules
	if err := m.loadSchedules(ctx); err != nil {
		return fmt.Errorf("failed to load schedules: %w", err)
	}

	// Start cron scheduler
	m.cron.Start()

	log.Println("Report scheduler started")

	// Handle context cancellation
	go func() {
		<-ctx.Done()
		m.Stop()
	}()

	return nil
}

// Stop stops the scheduler
func (m *Manager) Stop() {
	log.Println("Stopping report scheduler...")
	ctx := m.cron.Stop()
	<-ctx.Done()
	log.Println("Report scheduler stopped")
}

func (m *Manager) loadSchedules(ctx context.Context) error {
	schedules, err := m.repository.GetActiveSchedules(ctx)
	if err != nil {
		return err
	}

	for _, schedule := range schedules {
		if err := m.AddSchedule(schedule); err != nil {
			log.Printf("Failed to add schedule %s: %v", schedule.ID, err)
		}
	}

	return nil
}

// AddSchedule adds a new schedule to the scheduler
func (m *Manager) AddSchedule(schedule Schedule) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Parse timezone
	loc := time.UTC
	if schedule.Timezone != "" {
		var err error
		loc, err = time.LoadLocation(schedule.Timezone)
		if err != nil {
			log.Printf("Invalid timezone %s, using UTC", schedule.Timezone)
		}
	}

	// Create job function
	scheduleID := schedule.ID
	jobFunc := func() {
		m.executeJob(scheduleID)
	}

	// Add to cron with timezone
	cronWithTZ := cron.New(cron.WithSeconds(), cron.WithLocation(loc))

	// Parse cron expression
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	cronSchedule, err := parser.Parse(schedule.CronExpression)
	if err != nil {
		return fmt.Errorf("invalid cron expression: %w", err)
	}

	// Add job to main cron
	entryID := m.cron.Schedule(cronSchedule, cron.FuncJob(jobFunc))
	m.jobs[schedule.ID] = entryID

	// Calculate and store next run time
	nextRun := cronSchedule.Next(time.Now().In(loc))
	m.repository.UpdateNextRun(context.Background(), schedule.ID, nextRun)

	cronWithTZ.Stop()

	log.Printf("Added schedule %s (%s) with cron: %s", schedule.Name, schedule.ID, schedule.CronExpression)
	return nil
}

// RemoveSchedule removes a schedule from the scheduler
func (m *Manager) RemoveSchedule(scheduleID uuid.UUID) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if entryID, exists := m.jobs[scheduleID]; exists {
		m.cron.Remove(entryID)
		delete(m.jobs, scheduleID)
		log.Printf("Removed schedule %s", scheduleID)
	}
}

// UpdateSchedule updates an existing schedule
func (m *Manager) UpdateSchedule(schedule Schedule) error {
	m.RemoveSchedule(schedule.ID)
	if schedule.IsActive {
		return m.AddSchedule(schedule)
	}
	return nil
}

func (m *Manager) executeJob(scheduleID uuid.UUID) {
	// Acquire worker slot
	select {
	case m.workerPool <- struct{}{}:
		defer func() { <-m.workerPool }()
	default:
		log.Printf("Worker pool full, skipping schedule %s", scheduleID)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	// Check if schedule is still valid
	schedule, err := m.repository.GetSchedule(ctx, scheduleID)
	if err != nil {
		log.Printf("Failed to get schedule %s: %v", scheduleID, err)
		return
	}

	// Check date constraints
	now := time.Now()
	if schedule.StartDate != nil && now.Before(*schedule.StartDate) {
		log.Printf("Schedule %s not yet active (starts %s)", scheduleID, schedule.StartDate)
		return
	}
	if schedule.EndDate != nil && now.After(*schedule.EndDate) {
		log.Printf("Schedule %s has expired (ended %s)", scheduleID, schedule.EndDate)
		return
	}

	log.Printf("Executing scheduled report %s (%s)", schedule.Name, scheduleID)

	// Execute the report
	if err := m.executor.ExecuteScheduledReport(ctx, scheduleID); err != nil {
		log.Printf("Failed to execute schedule %s: %v", scheduleID, err)
		return
	}

	// Update last run time
	m.repository.UpdateLastRun(ctx, scheduleID, now)

	log.Printf("Completed scheduled report %s", scheduleID)
}

// GetNextRuns returns the next run times for all schedules
func (m *Manager) GetNextRuns() map[uuid.UUID]time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[uuid.UUID]time.Time)
	for scheduleID, entryID := range m.jobs {
		entry := m.cron.Entry(entryID)
		if !entry.Next.IsZero() {
			result[scheduleID] = entry.Next
		}
	}
	return result
}

// RunNow triggers immediate execution of a schedule
func (m *Manager) RunNow(ctx context.Context, scheduleID uuid.UUID) error {
	go m.executeJob(scheduleID)
	return nil
}

// CronParser provides cron expression parsing utilities
type CronParser struct {
	parser cron.Parser
}

// NewCronParser creates a new cron parser
func NewCronParser() *CronParser {
	return &CronParser{
		parser: cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow),
	}
}

// Validate validates a cron expression
func (p *CronParser) Validate(expression string) error {
	_, err := p.parser.Parse(expression)
	return err
}

// GetNextN returns the next N execution times
func (p *CronParser) GetNextN(expression string, n int, from time.Time) ([]time.Time, error) {
	schedule, err := p.parser.Parse(expression)
	if err != nil {
		return nil, err
	}

	times := make([]time.Time, n)
	current := from
	for i := 0; i < n; i++ {
		current = schedule.Next(current)
		times[i] = current
	}
	return times, nil
}

// GetDescription returns a human-readable description of the cron expression
func (p *CronParser) GetDescription(expression string) string {
	// Simple descriptions for common patterns
	switch expression {
	case "0 0 * * *":
		return "Daily at midnight"
	case "0 0 * * 0":
		return "Weekly on Sunday at midnight"
	case "0 0 1 * *":
		return "Monthly on the 1st at midnight"
	case "0 9 * * 1-5":
		return "Weekdays at 9 AM"
	case "0 0 * * 1":
		return "Weekly on Monday at midnight"
	default:
		return fmt.Sprintf("Custom schedule: %s", expression)
	}
}
