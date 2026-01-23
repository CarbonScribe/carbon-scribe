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

// AggregationWorker refreshes stale dashboard aggregates
type AggregationWorker struct {
	db     *sqlx.DB
	logger *zap.Logger
	config AggregationWorkerConfig
	done   chan struct{}
}

// AggregationWorkerConfig configuration for the aggregation worker
type AggregationWorkerConfig struct {
	RefreshInterval time.Duration
	BatchSize       int
	MaxConcurrent   int
	StaleThreshold  time.Duration
}

// DefaultAggregationWorkerConfig returns default configuration
func DefaultAggregationWorkerConfig() AggregationWorkerConfig {
	return AggregationWorkerConfig{
		RefreshInterval: time.Minute,
		BatchSize:       20,
		MaxConcurrent:   5,
		StaleThreshold:  5 * time.Minute,
	}
}

// NewAggregationWorker creates a new aggregation worker
func NewAggregationWorker(db *sqlx.DB, logger *zap.Logger, config AggregationWorkerConfig) *AggregationWorker {
	return &AggregationWorker{
		db:     db,
		logger: logger,
		config: config,
		done:   make(chan struct{}),
	}
}

// Start starts the aggregation worker
func (w *AggregationWorker) Start(ctx context.Context) error {
	w.logger.Info("Starting aggregation worker",
		zap.Duration("refresh_interval", w.config.RefreshInterval),
		zap.Int("batch_size", w.config.BatchSize))

	ticker := time.NewTicker(w.config.RefreshInterval)
	defer ticker.Stop()

	// Process stale aggregates immediately
	w.refreshStaleAggregates(ctx)

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("Aggregation worker shutting down")
			return nil
		case <-w.done:
			w.logger.Info("Aggregation worker stopped")
			return nil
		case <-ticker.C:
			w.refreshStaleAggregates(ctx)
		}
	}
}

// Stop stops the aggregation worker
func (w *AggregationWorker) Stop() {
	close(w.done)
}

// StaleAggregate represents a stale aggregate that needs refresh
type StaleAggregate struct {
	ID            string
	AggregateKey  string
	AggregateType string
	ProjectID     *string
	UserID        *string
	PeriodType    string
	ComputedAt    time.Time
}

// refreshStaleAggregates refreshes stale aggregates
func (w *AggregationWorker) refreshStaleAggregates(ctx context.Context) {
	// Get stale aggregates
	aggregates, err := w.getStaleAggregates(ctx, w.config.BatchSize)
	if err != nil {
		w.logger.Error("Failed to get stale aggregates", zap.Error(err))
		return
	}

	if len(aggregates) == 0 {
		return
	}

	w.logger.Info("Refreshing stale aggregates", zap.Int("count", len(aggregates)))

	// Process with concurrency limit
	sem := make(chan struct{}, w.config.MaxConcurrent)

	for _, agg := range aggregates {
		sem <- struct{}{}

		go func(aggregate *StaleAggregate) {
			defer func() { <-sem }()
			w.refreshAggregate(ctx, aggregate)
		}(agg)
	}

	// Wait for completion
	for i := 0; i < w.config.MaxConcurrent; i++ {
		sem <- struct{}{}
	}
}

// getStaleAggregates retrieves stale aggregates from the database
func (w *AggregationWorker) getStaleAggregates(ctx context.Context, limit int) ([]*StaleAggregate, error) {
	query := `
		SELECT id, aggregate_key, aggregate_type, project_id, user_id, period_type, computed_at
		FROM dashboard_aggregates
		WHERE is_stale = true OR computed_at < NOW() - $1::interval
		ORDER BY computed_at ASC
		LIMIT $2
	`

	rows, err := w.db.QueryContext(ctx, query, w.config.StaleThreshold.String(), limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query stale aggregates: %w", err)
	}
	defer rows.Close()

	var aggregates []*StaleAggregate
	for rows.Next() {
		var agg StaleAggregate
		err := rows.Scan(
			&agg.ID,
			&agg.AggregateKey,
			&agg.AggregateType,
			&agg.ProjectID,
			&agg.UserID,
			&agg.PeriodType,
			&agg.ComputedAt,
		)
		if err != nil {
			w.logger.Error("Failed to scan aggregate row", zap.Error(err))
			continue
		}
		aggregates = append(aggregates, &agg)
	}

	return aggregates, nil
}

// refreshAggregate refreshes a single aggregate
func (w *AggregationWorker) refreshAggregate(ctx context.Context, aggregate *StaleAggregate) {
	w.logger.Debug("Refreshing aggregate",
		zap.String("key", aggregate.AggregateKey),
		zap.String("type", aggregate.AggregateType))

	startTime := time.Now()

	// Compute new aggregate based on type
	var data map[string]interface{}
	var err error

	switch aggregate.AggregateType {
	case "dashboard_summary":
		data, err = w.computeDashboardSummary(ctx, aggregate.ProjectID)
	case "project_summary":
		data, err = w.computeProjectSummary(ctx, aggregate.ProjectID)
	case "credit_summary":
		data, err = w.computeCreditSummary(ctx, aggregate.ProjectID)
	case "revenue_summary":
		data, err = w.computeRevenueSummary(ctx, aggregate.ProjectID)
	default:
		w.logger.Warn("Unknown aggregate type", zap.String("type", aggregate.AggregateType))
		return
	}

	if err != nil {
		w.logger.Error("Failed to compute aggregate",
			zap.String("key", aggregate.AggregateKey),
			zap.Error(err))
		return
	}

	// Update the aggregate
	if err := w.updateAggregate(ctx, aggregate.ID, data); err != nil {
		w.logger.Error("Failed to update aggregate",
			zap.String("key", aggregate.AggregateKey),
			zap.Error(err))
		return
	}

	w.logger.Debug("Aggregate refreshed",
		zap.String("key", aggregate.AggregateKey),
		zap.Duration("duration", time.Since(startTime)))
}

// computeDashboardSummary computes dashboard summary aggregate
func (w *AggregationWorker) computeDashboardSummary(ctx context.Context, projectID *string) (map[string]interface{}, error) {
	// Build query based on whether project is specified
	var query string
	var args []interface{}

	if projectID != nil {
		query = `
			SELECT 
				COUNT(*) as total_projects,
				COUNT(*) FILTER (WHERE status = 'active') as active_projects,
				COALESCE(SUM(total_area_hectares), 0) as total_area
			FROM projects
			WHERE id = $1
		`
		args = append(args, *projectID)
	} else {
		query = `
			SELECT 
				COUNT(*) as total_projects,
				COUNT(*) FILTER (WHERE status = 'active') as active_projects,
				COALESCE(SUM(total_area_hectares), 0) as total_area
			FROM projects
		`
	}

	var totalProjects, activeProjects int
	var totalArea float64

	err := w.db.QueryRowContext(ctx, query, args...).Scan(&totalProjects, &activeProjects, &totalArea)
	if err != nil {
		return nil, fmt.Errorf("failed to compute dashboard summary: %w", err)
	}

	return map[string]interface{}{
		"total_projects":    totalProjects,
		"active_projects":   activeProjects,
		"total_area_hectares": totalArea,
	}, nil
}

// computeProjectSummary computes project summary aggregate
func (w *AggregationWorker) computeProjectSummary(ctx context.Context, projectID *string) (map[string]interface{}, error) {
	if projectID == nil {
		return nil, fmt.Errorf("project_id is required for project_summary")
	}

	query := `
		SELECT 
			p.name,
			p.status,
			p.total_area_hectares,
			COALESCE(SUM(c.issued_tons), 0) as total_credits,
			COUNT(c.id) as credit_count
		FROM projects p
		LEFT JOIN carbon_credits c ON c.project_id = p.id
		WHERE p.id = $1
		GROUP BY p.id
	`

	var name, status string
	var totalArea, totalCredits float64
	var creditCount int

	err := w.db.QueryRowContext(ctx, query, *projectID).Scan(
		&name, &status, &totalArea, &totalCredits, &creditCount,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to compute project summary: %w", err)
	}

	return map[string]interface{}{
		"name":              name,
		"status":            status,
		"total_area_hectares": totalArea,
		"total_credits":     totalCredits,
		"credit_count":      creditCount,
	}, nil
}

// computeCreditSummary computes credit summary aggregate
func (w *AggregationWorker) computeCreditSummary(ctx context.Context, projectID *string) (map[string]interface{}, error) {
	var query string
	var args []interface{}

	if projectID != nil {
		query = `
			SELECT 
				COALESCE(SUM(calculated_tons), 0) as total_calculated,
				COALESCE(SUM(issued_tons), 0) as total_issued,
				COALESCE(AVG(data_quality_score), 0) as avg_quality_score
			FROM carbon_credits
			WHERE project_id = $1
		`
		args = append(args, *projectID)
	} else {
		query = `
			SELECT 
				COALESCE(SUM(calculated_tons), 0) as total_calculated,
				COALESCE(SUM(issued_tons), 0) as total_issued,
				COALESCE(AVG(data_quality_score), 0) as avg_quality_score
			FROM carbon_credits
		`
	}

	var totalCalculated, totalIssued, avgQualityScore float64

	err := w.db.QueryRowContext(ctx, query, args...).Scan(
		&totalCalculated, &totalIssued, &avgQualityScore,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to compute credit summary: %w", err)
	}

	return map[string]interface{}{
		"total_calculated":     totalCalculated,
		"total_issued":         totalIssued,
		"average_quality_score": avgQualityScore,
	}, nil
}

// computeRevenueSummary computes revenue summary aggregate
func (w *AggregationWorker) computeRevenueSummary(ctx context.Context, projectID *string) (map[string]interface{}, error) {
	var query string
	var args []interface{}

	if projectID != nil {
		query = `
			SELECT 
				COALESCE(SUM(amount), 0) as total_revenue,
				COUNT(*) as transaction_count,
				COALESCE(AVG(amount), 0) as average_amount
			FROM payment_transactions
			WHERE project_id = $1 AND status = 'completed'
		`
		args = append(args, *projectID)
	} else {
		query = `
			SELECT 
				COALESCE(SUM(amount), 0) as total_revenue,
				COUNT(*) as transaction_count,
				COALESCE(AVG(amount), 0) as average_amount
			FROM payment_transactions
			WHERE status = 'completed'
		`
	}

	var totalRevenue, avgAmount float64
	var transactionCount int

	err := w.db.QueryRowContext(ctx, query, args...).Scan(
		&totalRevenue, &transactionCount, &avgAmount,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to compute revenue summary: %w", err)
	}

	return map[string]interface{}{
		"total_revenue":      totalRevenue,
		"transaction_count":  transactionCount,
		"average_amount":     avgAmount,
	}, nil
}

// updateAggregate updates an aggregate in the database
func (w *AggregationWorker) updateAggregate(ctx context.Context, aggregateID string, data map[string]interface{}) error {
	query := `
		UPDATE dashboard_aggregates SET
			data = $2,
			computed_at = NOW(),
			is_stale = false,
			updated_at = NOW()
		WHERE id = $1
	`

	_, err := w.db.ExecContext(ctx, query, aggregateID, data)
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
	config := DefaultAggregationWorkerConfig()
	worker := NewAggregationWorker(db, logger, config)

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
	logger.Info("Aggregation worker starting")
	if err := worker.Start(ctx); err != nil {
		logger.Error("Worker error", zap.Error(err))
	}

	logger.Info("Aggregation worker stopped")
}
