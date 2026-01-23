package dashboard

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Aggregator handles dashboard data aggregation
type Aggregator struct {
	repository AggregateRepository
	cache      *AggregateCache
	logger     *zap.Logger
	config     AggregatorConfig
}

// AggregateRepository interface for aggregate data access
type AggregateRepository interface {
	GetAggregate(ctx context.Context, key string) (*Aggregate, error)
	UpsertAggregate(ctx context.Context, aggregate *Aggregate) error
	GetStaleAggregates(ctx context.Context, limit int) ([]*Aggregate, error)
	MarkAggregatesStale(ctx context.Context, aggregateType string, projectID *uuid.UUID) error
	
	// Data queries for computing aggregates
	GetProjectSummary(ctx context.Context, projectID *uuid.UUID) (*ProjectSummaryData, error)
	GetCreditSummary(ctx context.Context, projectID *uuid.UUID, startDate, endDate *time.Time) (*CreditSummaryData, error)
	GetRevenueSummary(ctx context.Context, projectID *uuid.UUID, startDate, endDate *time.Time) (*RevenueSummaryData, error)
	GetMonitoringSummary(ctx context.Context, projectID *uuid.UUID, startDate, endDate *time.Time) (*MonitoringSummaryData, error)
}

// Aggregate represents a cached aggregate
type Aggregate struct {
	ID                 uuid.UUID         `json:"id"`
	AggregateKey       string            `json:"aggregate_key"`
	AggregateType      string            `json:"aggregate_type"`
	ProjectID          *uuid.UUID        `json:"project_id,omitempty"`
	UserID             *uuid.UUID        `json:"user_id,omitempty"`
	OrganizationID     *uuid.UUID        `json:"organization_id,omitempty"`
	PeriodType         string            `json:"period_type"`
	PeriodStart        *time.Time        `json:"period_start,omitempty"`
	PeriodEnd          *time.Time        `json:"period_end,omitempty"`
	Data               map[string]any    `json:"data"`
	SourceRecordCount  *int              `json:"source_record_count,omitempty"`
	LastSourceUpdateAt *time.Time        `json:"last_source_update_at,omitempty"`
	ComputedAt         time.Time         `json:"computed_at"`
	IsStale            bool              `json:"is_stale"`
}

// ProjectSummaryData raw data for project summary
type ProjectSummaryData struct {
	TotalProjects    int            `json:"total_projects"`
	ActiveProjects   int            `json:"active_projects"`
	PendingProjects  int            `json:"pending_projects"`
	CompletedProjects int           `json:"completed_projects"`
	ProjectsByStatus map[string]int `json:"projects_by_status"`
	ProjectsByRegion map[string]int `json:"projects_by_region"`
	TotalAreaHectares float64       `json:"total_area_hectares"`
}

// CreditSummaryData raw data for credit summary
type CreditSummaryData struct {
	TotalCalculated   float64          `json:"total_calculated"`
	TotalIssued       float64          `json:"total_issued"`
	TotalRetired      float64          `json:"total_retired"`
	TotalBuffered     float64          `json:"total_buffered"`
	CreditsByStatus   map[string]float64 `json:"credits_by_status"`
	CreditsByVintage  map[int]float64    `json:"credits_by_vintage"`
	AverageQualityScore float64        `json:"average_quality_score"`
}

// RevenueSummaryData raw data for revenue summary
type RevenueSummaryData struct {
	TotalRevenue       float64            `json:"total_revenue"`
	TotalTransactions  int                `json:"total_transactions"`
	AveragePrice       float64            `json:"average_price"`
	RevenueByMonth     map[string]float64 `json:"revenue_by_month"`
	RevenueByType      map[string]float64 `json:"revenue_by_type"`
	TonsSold           float64            `json:"tons_sold"`
	PendingPayments    float64            `json:"pending_payments"`
}

// MonitoringSummaryData raw data for monitoring summary
type MonitoringSummaryData struct {
	AverageNDVI          float64            `json:"average_ndvi"`
	NDVITrend            []float64          `json:"ndvi_trend"`
	ActiveAlerts         int                `json:"active_alerts"`
	AlertsByType         map[string]int     `json:"alerts_by_type"`
	LastSatelliteUpdate  *time.Time         `json:"last_satellite_update,omitempty"`
	DataPointsCollected  int                `json:"data_points_collected"`
	AverageConfidence    float64            `json:"average_confidence"`
}

// AggregatorConfig configuration for the aggregator
type AggregatorConfig struct {
	CacheTTL         time.Duration `json:"cache_ttl"`
	RefreshInterval  time.Duration `json:"refresh_interval"`
	MaxStaleAge      time.Duration `json:"max_stale_age"`
	ConcurrentRefresh int          `json:"concurrent_refresh"`
}

// DefaultAggregatorConfig returns default configuration
func DefaultAggregatorConfig() AggregatorConfig {
	return AggregatorConfig{
		CacheTTL:         5 * time.Minute,
		RefreshInterval:  time.Minute,
		MaxStaleAge:      15 * time.Minute,
		ConcurrentRefresh: 5,
	}
}

// NewAggregator creates a new aggregator
func NewAggregator(repository AggregateRepository, logger *zap.Logger, config AggregatorConfig) *Aggregator {
	return &Aggregator{
		repository: repository,
		cache:      NewAggregateCache(config.CacheTTL),
		logger:     logger,
		config:     config,
	}
}

// GetDashboardSummary gets the complete dashboard summary
func (a *Aggregator) GetDashboardSummary(ctx context.Context, projectID *uuid.UUID, periodType string) (*DashboardSummary, error) {
	// Build cache key
	cacheKey := buildAggregateKey("dashboard_summary", projectID, periodType)

	// Try cache first
	if cached, ok := a.cache.Get(cacheKey); ok {
		if summary, ok := cached.(*DashboardSummary); ok {
			return summary, nil
		}
	}

	// Compute fresh data
	summary, err := a.computeDashboardSummary(ctx, projectID, periodType)
	if err != nil {
		return nil, err
	}

	// Cache the result
	a.cache.Set(cacheKey, summary)

	// Store in database for persistence
	go a.persistAggregate(context.Background(), cacheKey, "dashboard_summary", projectID, periodType, summary)

	return summary, nil
}

// computeDashboardSummary computes fresh dashboard summary data
func (a *Aggregator) computeDashboardSummary(ctx context.Context, projectID *uuid.UUID, periodType string) (*DashboardSummary, error) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var errs []error

	summary := &DashboardSummary{
		ComputedAt: time.Now(),
	}

	// Get time range based on period type
	startDate, endDate := a.getTimeRange(periodType)

	// Fetch data concurrently
	wg.Add(4)

	// Project summary
	go func() {
		defer wg.Done()
		data, err := a.repository.GetProjectSummary(ctx, projectID)
		if err != nil {
			mu.Lock()
			errs = append(errs, fmt.Errorf("project summary: %w", err))
			mu.Unlock()
			return
		}
		mu.Lock()
		summary.TotalProjects = data.TotalProjects
		summary.ActiveProjects = data.ActiveProjects
		summary.ProjectsByStatus = data.ProjectsByStatus
		summary.ProjectsByRegion = data.ProjectsByRegion
		summary.TotalAreaHectares = data.TotalAreaHectares
		mu.Unlock()
	}()

	// Credit summary
	go func() {
		defer wg.Done()
		data, err := a.repository.GetCreditSummary(ctx, projectID, startDate, endDate)
		if err != nil {
			mu.Lock()
			errs = append(errs, fmt.Errorf("credit summary: %w", err))
			mu.Unlock()
			return
		}
		mu.Lock()
		summary.TotalCreditsIssued = data.TotalIssued
		summary.TotalCreditsRetired = data.TotalRetired
		summary.CreditsByStatus = data.CreditsByStatus
		summary.CreditsByVintage = data.CreditsByVintage
		summary.AverageQualityScore = data.AverageQualityScore
		mu.Unlock()
	}()

	// Revenue summary
	go func() {
		defer wg.Done()
		data, err := a.repository.GetRevenueSummary(ctx, projectID, startDate, endDate)
		if err != nil {
			mu.Lock()
			errs = append(errs, fmt.Errorf("revenue summary: %w", err))
			mu.Unlock()
			return
		}
		mu.Lock()
		summary.TotalRevenue = data.TotalRevenue
		summary.RevenueByMonth = data.RevenueByMonth
		summary.AveragePrice = data.AveragePrice
		summary.TonsSold = data.TonsSold
		mu.Unlock()
	}()

	// Monitoring summary
	go func() {
		defer wg.Done()
		data, err := a.repository.GetMonitoringSummary(ctx, projectID, startDate, endDate)
		if err != nil {
			mu.Lock()
			errs = append(errs, fmt.Errorf("monitoring summary: %w", err))
			mu.Unlock()
			return
		}
		mu.Lock()
		summary.AverageNDVI = data.AverageNDVI
		summary.ActiveAlerts = data.ActiveAlerts
		summary.AlertsByType = data.AlertsByType
		mu.Unlock()
	}()

	wg.Wait()

	if len(errs) > 0 {
		a.logger.Warn("Some aggregations failed", zap.Errors("errors", errs))
	}

	return summary, nil
}

// DashboardSummary complete dashboard summary
type DashboardSummary struct {
	// Projects
	TotalProjects      int                `json:"total_projects"`
	ActiveProjects     int                `json:"active_projects"`
	ProjectsByStatus   map[string]int     `json:"projects_by_status"`
	ProjectsByRegion   map[string]int     `json:"projects_by_region"`
	TotalAreaHectares  float64            `json:"total_area_hectares"`

	// Credits
	TotalCreditsIssued  float64            `json:"total_credits_issued"`
	TotalCreditsRetired float64            `json:"total_credits_retired"`
	CreditsByStatus     map[string]float64 `json:"credits_by_status"`
	CreditsByVintage    map[int]float64    `json:"credits_by_vintage"`
	AverageQualityScore float64            `json:"average_quality_score"`

	// Revenue
	TotalRevenue       float64            `json:"total_revenue"`
	RevenueByMonth     map[string]float64 `json:"revenue_by_month"`
	AveragePrice       float64            `json:"average_price"`
	TonsSold           float64            `json:"tons_sold"`

	// Monitoring
	AverageNDVI        float64            `json:"average_ndvi"`
	ActiveAlerts       int                `json:"active_alerts"`
	AlertsByType       map[string]int     `json:"alerts_by_type"`

	ComputedAt         time.Time          `json:"computed_at"`
}

// getTimeRange gets the time range for a period type
func (a *Aggregator) getTimeRange(periodType string) (*time.Time, *time.Time) {
	now := time.Now()
	var start time.Time

	switch periodType {
	case "daily":
		start = now.AddDate(0, 0, -1)
	case "weekly":
		start = now.AddDate(0, 0, -7)
	case "monthly":
		start = now.AddDate(0, -1, 0)
	case "quarterly":
		start = now.AddDate(0, -3, 0)
	case "yearly":
		start = now.AddDate(-1, 0, 0)
	default:
		// All time
		return nil, nil
	}

	return &start, &now
}

// persistAggregate persists an aggregate to the database
func (a *Aggregator) persistAggregate(ctx context.Context, key, aggregateType string, projectID *uuid.UUID, periodType string, data interface{}) {
	aggregate := &Aggregate{
		ID:            uuid.New(),
		AggregateKey:  key,
		AggregateType: aggregateType,
		ProjectID:     projectID,
		PeriodType:    periodType,
		Data:          toMap(data),
		ComputedAt:    time.Now(),
		IsStale:       false,
	}

	if err := a.repository.UpsertAggregate(ctx, aggregate); err != nil {
		a.logger.Error("Failed to persist aggregate", zap.Error(err), zap.String("key", key))
	}
}

// RefreshStaleAggregates refreshes stale aggregates
func (a *Aggregator) RefreshStaleAggregates(ctx context.Context) error {
	stale, err := a.repository.GetStaleAggregates(ctx, a.config.ConcurrentRefresh)
	if err != nil {
		return fmt.Errorf("failed to get stale aggregates: %w", err)
	}

	for _, agg := range stale {
		go a.refreshAggregate(ctx, agg)
	}

	return nil
}

// refreshAggregate refreshes a single aggregate
func (a *Aggregator) refreshAggregate(ctx context.Context, agg *Aggregate) {
	a.logger.Debug("Refreshing aggregate", zap.String("key", agg.AggregateKey))

	switch agg.AggregateType {
	case "dashboard_summary":
		summary, err := a.computeDashboardSummary(ctx, agg.ProjectID, agg.PeriodType)
		if err != nil {
			a.logger.Error("Failed to refresh aggregate", zap.Error(err), zap.String("key", agg.AggregateKey))
			return
		}
		a.cache.Set(agg.AggregateKey, summary)
		a.persistAggregate(ctx, agg.AggregateKey, agg.AggregateType, agg.ProjectID, agg.PeriodType, summary)
	}
}

// InvalidateProjectAggregates marks all project-related aggregates as stale
func (a *Aggregator) InvalidateProjectAggregates(ctx context.Context, projectID uuid.UUID) error {
	// Clear from cache
	a.cache.DeleteByPrefix(fmt.Sprintf("project_%s", projectID.String()))

	// Mark as stale in database
	return a.repository.MarkAggregatesStale(ctx, "dashboard_summary", &projectID)
}

// buildAggregateKey builds a cache key for an aggregate
func buildAggregateKey(aggregateType string, projectID *uuid.UUID, periodType string) string {
	key := aggregateType
	if projectID != nil {
		key += "_project_" + projectID.String()
	}
	if periodType != "" {
		key += "_" + periodType
	}
	return key
}

// toMap converts a struct to a map
func toMap(v interface{}) map[string]any {
	// This is a simplified conversion
	// In production, use reflection or a proper marshalling library
	result := make(map[string]any)
	// Add actual conversion logic here
	return result
}
