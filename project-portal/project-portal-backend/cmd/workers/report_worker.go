package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

// ReportWorker processes report execution jobs
type ReportWorker struct {
	db         *sqlx.DB
	logger     *zap.Logger
	config     ReportWorkerConfig
	done       chan struct{}
}

// ReportWorkerConfig configuration for the report worker
type ReportWorkerConfig struct {
	PollInterval      time.Duration
	BatchSize         int
	MaxConcurrent     int
	RetryAttempts     int
	RetryDelay        time.Duration
	ExecutionTimeout  time.Duration
}

// DefaultReportWorkerConfig returns default configuration
func DefaultReportWorkerConfig() ReportWorkerConfig {
	return ReportWorkerConfig{
		PollInterval:     30 * time.Second,
		BatchSize:        10,
		MaxConcurrent:    5,
		RetryAttempts:    3,
		RetryDelay:       time.Minute,
		ExecutionTimeout: 30 * time.Minute,
	}
}

// NewReportWorker creates a new report worker
func NewReportWorker(db *sqlx.DB, logger *zap.Logger, config ReportWorkerConfig) *ReportWorker {
	return &ReportWorker{
		db:     db,
		logger: logger,
		config: config,
		done:   make(chan struct{}),
	}
}

// Start starts the report worker
func (w *ReportWorker) Start(ctx context.Context) error {
	w.logger.Info("Starting report worker",
		zap.Duration("poll_interval", w.config.PollInterval),
		zap.Int("max_concurrent", w.config.MaxConcurrent))

	ticker := time.NewTicker(w.config.PollInterval)
	defer ticker.Stop()

	// Process any pending jobs immediately
	w.processPendingExecutions(ctx)

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("Report worker shutting down")
			return nil
		case <-w.done:
			w.logger.Info("Report worker stopped")
			return nil
		case <-ticker.C:
			w.processPendingExecutions(ctx)
		}
	}
}

// Stop stops the report worker
func (w *ReportWorker) Stop() {
	close(w.done)
}

// processPendingExecutions processes pending report executions
func (w *ReportWorker) processPendingExecutions(ctx context.Context) {
	// Get pending executions
	executions, err := w.getPendingExecutions(ctx, w.config.BatchSize)
	if err != nil {
		w.logger.Error("Failed to get pending executions", zap.Error(err))
		return
	}

	if len(executions) == 0 {
		return
	}

	w.logger.Info("Processing pending report executions", zap.Int("count", len(executions)))

	// Process executions with concurrency limit
	sem := make(chan struct{}, w.config.MaxConcurrent)

	for _, exec := range executions {
		sem <- struct{}{} // Acquire semaphore

		go func(execution *ReportExecution) {
			defer func() { <-sem }() // Release semaphore

			w.processExecution(ctx, execution)
		}(exec)
	}

	// Wait for all goroutines to finish
	for i := 0; i < w.config.MaxConcurrent; i++ {
		sem <- struct{}{}
	}
}

// ReportExecution represents a pending report execution
type ReportExecution struct {
	ID                 string
	ReportDefinitionID string
	ScheduleID         *string
	TriggeredBy        *string
	TriggeredAt        time.Time
	Status             string
	Parameters         map[string]interface{}
}

// getPendingExecutions retrieves pending executions from the database
func (w *ReportWorker) getPendingExecutions(ctx context.Context, limit int) ([]*ReportExecution, error) {
	query := `
		SELECT id, report_definition_id, schedule_id, triggered_by, triggered_at, status, parameters
		FROM report_executions
		WHERE status = 'pending'
		ORDER BY triggered_at ASC
		LIMIT $1
	`

	rows, err := w.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending executions: %w", err)
	}
	defer rows.Close()

	var executions []*ReportExecution
	for rows.Next() {
		var exec ReportExecution
		var paramsJSON []byte

		err := rows.Scan(
			&exec.ID,
			&exec.ReportDefinitionID,
			&exec.ScheduleID,
			&exec.TriggeredBy,
			&exec.TriggeredAt,
			&exec.Status,
			&paramsJSON,
		)
		if err != nil {
			w.logger.Error("Failed to scan execution row", zap.Error(err))
			continue
		}

		executions = append(executions, &exec)
	}

	return executions, nil
}

// processExecution processes a single report execution
func (w *ReportWorker) processExecution(ctx context.Context, execution *ReportExecution) {
	w.logger.Info("Processing report execution",
		zap.String("execution_id", execution.ID),
		zap.String("report_id", execution.ReportDefinitionID))

	startTime := time.Now()

	// Update status to processing
	if err := w.updateExecutionStatus(ctx, execution.ID, "processing", nil); err != nil {
		w.logger.Error("Failed to update execution status", zap.Error(err))
		return
	}

	// Create execution context with timeout
	execCtx, cancel := context.WithTimeout(ctx, w.config.ExecutionTimeout)
	defer cancel()

	// Execute the report (placeholder - integrate with actual execution logic)
	err := w.executeReport(execCtx, execution)

	duration := time.Since(startTime)

	if err != nil {
		w.logger.Error("Report execution failed",
			zap.String("execution_id", execution.ID),
			zap.Error(err),
			zap.Duration("duration", duration))

		errMsg := err.Error()
		w.updateExecutionStatus(ctx, execution.ID, "failed", &errMsg)
		return
	}

	w.logger.Info("Report execution completed",
		zap.String("execution_id", execution.ID),
		zap.Duration("duration", duration))

	w.updateExecutionStatus(ctx, execution.ID, "completed", nil)
}

// executeReport executes the report (placeholder implementation)
func (w *ReportWorker) executeReport(ctx context.Context, execution *ReportExecution) error {
	// This is where you would integrate with the actual report execution logic
	// For now, this is a placeholder

	// Simulate report execution
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(time.Second): // Simulate work
		return nil
	}
}

// updateExecutionStatus updates the status of an execution
func (w *ReportWorker) updateExecutionStatus(ctx context.Context, executionID, status string, errorMsg *string) error {
	query := `
		UPDATE report_executions SET
			status = $2,
			error_message = $3,
			completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
			started_at = CASE WHEN $2 = 'processing' THEN NOW() ELSE started_at END
		WHERE id = $1
	`

	_, err := w.db.ExecContext(ctx, query, executionID, status, errorMsg)
	return err
}

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@localhost:5432/carbon_scribe?sslmode=disable"
	}

	// Connect to database
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		logger.Fatal("Failed to ping database", zap.Error(err))
	}

	logger.Info("Connected to database")

	// Create worker
	config := DefaultReportWorkerConfig()
	worker := NewReportWorker(db, logger, config)

	// Create context that cancels on interrupt
	ctx, cancel := context.WithCancel(context.Background())

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		logger.Info("Shutdown signal received")
		cancel()
	}()

	// Start worker
	logger.Info("Report worker starting")
	if err := worker.Start(ctx); err != nil {
		logger.Error("Worker error", zap.Error(err))
	}

	logger.Info("Report worker stopped")
}
