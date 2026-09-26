package monitoring

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/ingestion"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/processing"
)

// Service orchestrates monitoring data ingestion and retrieval.
type Service struct {
	pipeline        *ingestion.SatellitePipeline
	webhookPipeline *ingestion.WebhookPipeline
	iotPipeline     *ingestion.IoTPipeline
	repo            Repository
	tileCache       *TileCache
}

// NewService constructs a monitoring Service.
func NewService(repo Repository) *Service {
	return &Service{
		pipeline:        ingestion.NewSatellitePipeline(repo),
		webhookPipeline: ingestion.NewWebhookPipeline(repo),
		iotPipeline:     ingestion.NewIoTPipeline(repo),
		repo:            repo,
		tileCache:       NewTileCache(24 * time.Hour),
	}
}

// ============================================================================
// Satellite Methods
// ============================================================================

// IngestSatellite validates and persists a satellite reading.
func (s *Service) IngestSatellite(ctx context.Context, req IngestSatelliteRequest) (*SatelliteReading, error) {
	ir := ingestion.IngestRequest{
		ProjectID:   req.ProjectID,
		Source:      req.Source,
		DataType:    req.DataType,
		NDVIMean:    req.NDVIMean,
		NDVIMin:     req.NDVIMin,
		NDVIMax:     req.NDVIMax,
		BiomassTons: req.BiomassTons,
		ImageryURL:  req.ImageryURL,
		BoundingBox: req.BoundingBox,
		Metadata:    req.Metadata,
		CapturedAt:  req.CapturedAt,
	}
	return s.pipeline.Ingest(ctx, ir)
}

// ListReadings returns the most recent satellite readings for a project.
func (s *Service) ListReadings(ctx context.Context, projectID string, limit int) ([]SatelliteReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListByProject(ctx, projectID, limit)
}

// GetNDVITile retrieves or generates a tile for NDVI.
func (s *Service) GetNDVITile(ctx context.Context, projectID, z, x, y string, start, end time.Time, useMVT bool) ([]byte, error) {
	cacheKey := fmt.Sprintf("tile_%s_%s_%s_%s_%d_%d_%v", projectID, z, x, y, start.Unix(), end.Unix(), useMVT)
	
	if cached, found := s.tileCache.Get(cacheKey); found {
		return cached, nil
	}
	
	limit := 1
	readings, err := s.repo.ListByProject(ctx, projectID, limit)
	if err != nil || len(readings) == 0 {
		emptyResult := processing.NDVIResult{Width: 256, Height: 256}
		if useMVT {
			return processing.GenerateMVTTile(emptyResult)
		}
		return processing.GeneratePNGTile(emptyResult, 256, 256)
	}

	// Mock computing NDVI from satellite reading
	width, height := 256, 256
	pixels := make([]float64, width*height)
	val := 0.0
	if readings[0].NDVIMean != nil {
		val = *readings[0].NDVIMean
	}
	for i := range pixels {
		pixels[i] = val
	}
	ndviRes := processing.NDVIResult{
		Pixels: pixels,
		Width:  width,
		Height: height,
		Mean:   val,
	}
	
	var tileData []byte
	if useMVT {
		tileData, err = processing.GenerateMVTTile(ndviRes)
	} else {
		tileData, err = processing.GeneratePNGTile(ndviRes, width, height)
	}
	if err != nil {
		return nil, err
	}
	
	s.tileCache.Set(cacheKey, tileData)
	return tileData, nil
}

// GetNDVITimeSeriesAnimation generates a time-series animation (JSON format for tiles)
func (s *Service) GetNDVITimeSeriesAnimation(ctx context.Context, projectID, z, x, y string, start, end time.Time) (map[string]interface{}, error) {
	return map[string]interface{}{
		"project_id": projectID,
		"z":          z,
		"x":          x,
		"y":          y,
		"tiles": []map[string]interface{}{
			{
				"timestamp": start.Format(time.RFC3339),
				"url": fmt.Sprintf(
					"/api/v1/monitoring/ndvi/tile/%s/%s/%s?project_id=%s&date_start=%s&date_end=%s",
					z, x, y, projectID,
					start.Format(time.RFC3339),
					start.Add(24*time.Hour).Format(time.RFC3339),
				),
			},
		},
	}, nil
}

// ============================================================================
// Webhook Methods
// ============================================================================

// IngestWebhook validates and persists a webhook reading.
func (s *Service) IngestWebhook(ctx context.Context, req IngestWebhookRequest) (*WebhookReading, error) {
	wr := ingestion.WebhookRequest{
		ProjectID:   req.ProjectID,
		Source:      req.Source,
		SourceType:  req.SourceType,
		MetricName:  req.MetricName,
		MetricValue: req.MetricValue,
		Unit:        req.Unit,
		Location:    req.Location,
		Metadata:    req.Metadata,
		CapturedAt:  req.CapturedAt,
		WebhookID:   req.WebhookID,
	}
	return s.webhookPipeline.Ingest(ctx, wr)
}

// ListWebhookReadings returns the most recent webhook readings for a project.
func (s *Service) ListWebhookReadings(ctx context.Context, projectID string, limit int) ([]WebhookReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListWebhookReadings(ctx, projectID, limit)
}

// ListWebhookReadingsByMetric returns readings filtered by metric name.
func (s *Service) ListWebhookReadingsByMetric(ctx context.Context, projectID, metricName string, limit int) ([]WebhookReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListWebhookReadingsByMetric(ctx, projectID, metricName, limit)
}

// ListWebhookReadingsBySource returns readings filtered by source.
func (s *Service) ListWebhookReadingsBySource(ctx context.Context, projectID, source string, limit int) ([]WebhookReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListWebhookReadingsBySource(ctx, projectID, source, limit)
}

// ============================================================================
// IoT Methods
// ============================================================================

// IngestIoT validates and persists an IoT reading.
func (s *Service) IngestIoT(ctx context.Context, req IngestIoTRequest) (*IoTReading, error) {
	ir := ingestion.IoTRequest{
		ProjectID:      req.ProjectID,
		SensorID:       req.SensorID,
		SensorType:     req.SensorType,
		Value:          req.Value,
		Unit:           req.Unit,
		Location:       req.Location,
		Metadata:       req.Metadata,
		CapturedAt:     req.CapturedAt,
		DeviceID:       req.DeviceID,
		BatteryLevel:   req.BatteryLevel,
		SignalStrength: req.SignalStrength,
	}
	return s.iotPipeline.Ingest(ctx, ir)
}

// ListIoTReadings returns the most recent IoT readings for a project.
func (s *Service) ListIoTReadings(ctx context.Context, projectID string, limit int) ([]IoTReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.GetIoTReadingsByProject(ctx, projectID, limit)
}

// ListIoTReadingsBySensor returns readings filtered by sensor ID.
func (s *Service) ListIoTReadingsBySensor(ctx context.Context, projectID, sensorID string, limit int) ([]IoTReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.GetIoTReadingsBySensor(ctx, projectID, sensorID, limit)
}

// ListIoTReadingsByType returns readings filtered by sensor type.
func (s *Service) ListIoTReadingsByType(ctx context.Context, projectID, sensorType string, limit int) ([]IoTReading, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.GetIoTReadingsByType(ctx, projectID, sensorType, limit)
}

// ============================================================================
// Metrics Methods
// ============================================================================

// SaveMetric stores a single system metric.
func (s *Service) SaveMetric(ctx context.Context, metric *SystemMetric) error {
	return s.repo.SaveMetric(ctx, metric)
}

// SaveMetricsBatch stores multiple metrics in a single transaction.
func (s *Service) SaveMetricsBatch(ctx context.Context, metrics []SystemMetric) error {
	return s.repo.SaveMetricsBatch(ctx, metrics)
}

// QueryMetrics retrieves metrics by name, time range, and service labels.
func (s *Service) QueryMetrics(ctx context.Context, req MetricQueryRequest) ([]SystemMetric, error) {
	return s.repo.QueryMetrics(ctx, req)
}

// GetMetricAggregation computes aggregates over a time window.
func (s *Service) GetMetricAggregation(ctx context.Context, req AggregationRequest) (*MetricAggregationResult, error) {
	return s.repo.GetMetricAggregation(ctx, req)
}

// GetMetricRate computes the rate of change for a metric over a time window.
func (s *Service) GetMetricRate(ctx context.Context, req RateRequest) (*RateResult, error) {
	return s.repo.GetMetricRate(ctx, req)
}

// GetLatestMetric retrieves the most recent metric for a given name and service.
func (s *Service) GetLatestMetric(ctx context.Context, metricName, service string) (*SystemMetric, error) {
	return s.repo.GetLatestMetric(ctx, metricName, service)
}

// GetMetricLabels returns distinct label combinations for a metric.
func (s *Service) GetMetricLabels(ctx context.Context, metricName string) ([]map[string]string, error) {
	return s.repo.GetMetricLabels(ctx, metricName)
}

// CleanupOldMetrics removes metrics older than the retention period.
func (s *Service) CleanupOldMetrics(ctx context.Context, retentionDays int) (int64, error) {
	return s.repo.CleanupOldMetrics(ctx, retentionDays)
}

// ============================================================================
// Health Check Methods
// ============================================================================

// SaveHealthCheck inserts a ServiceHealthCheck.
func (s *Service) SaveHealthCheck(ctx context.Context, check *ServiceHealthCheck) error {
	return s.repo.SaveHealthCheck(ctx, check)
}

// SaveHealthCheckResult inserts a HealthCheckResult.
func (s *Service) SaveHealthCheckResult(ctx context.Context, result *HealthCheckResult) error {
	return s.repo.SaveHealthCheckResult(ctx, result)
}

// GetHealthCheck retrieves a health check by ID.
func (s *Service) GetHealthCheck(ctx context.Context, checkID string) (*ServiceHealthCheck, error) {
	return s.repo.GetHealthCheck(ctx, checkID)
}

// GetHealthCheckResults retrieves health check results for a check ID.
func (s *Service) GetHealthCheckResults(ctx context.Context, checkID string, limit int) ([]HealthCheckResult, error) {
	return s.repo.GetHealthCheckResults(ctx, checkID, limit)
}

// GetHealthChecksByService retrieves all health checks for a service.
func (s *Service) GetHealthChecksByService(ctx context.Context, serviceName string) ([]ServiceHealthCheck, error) {
	return s.repo.GetHealthChecksByService(ctx, serviceName)
}

// GetHealthCheckResultsByTimeRange retrieves health check results within a time range.
func (s *Service) GetHealthCheckResultsByTimeRange(ctx context.Context, serviceName string, start, end time.Time) ([]HealthCheckResult, error) {
	return s.repo.GetHealthCheckResultsByTimeRange(ctx, serviceName, start, end)
}

// GetLatestHealthCheckResult retrieves the latest health check result for a service.
func (s *Service) GetLatestHealthCheckResult(ctx context.Context, serviceName string) (*HealthCheckResult, error) {
	return s.repo.GetLatestHealthCheckResult(ctx, serviceName)
}

// ============================================================================
// Alert Methods
// ============================================================================

// CreateAlert creates a new system alert.
func (s *Service) CreateAlert(ctx context.Context, req CreateAlertRequest) (*SystemAlert, error) {
	now := time.Now()
	alert := &SystemAlert{
		ID:          uuid.NewString(),
		ServiceName: req.ServiceName,
		Severity:    req.Severity,
		Status:      AlertStatusActive,
		Title:       req.Title,
		Message:     req.Message,
		Details:     req.Details,
		TriggeredBy: req.TriggeredBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.SaveAlert(ctx, alert); err != nil {
		return nil, err
	}
	return alert, nil
}

// GetAlert retrieves an alert by ID.
func (s *Service) GetAlert(ctx context.Context, alertID string) (*SystemAlert, error) {
	return s.repo.GetAlert(ctx, alertID)
}

// ListAlerts retrieves alerts with optional filters.
func (s *Service) ListAlerts(ctx context.Context, status AlertStatus, severity AlertSeverity, limit int) ([]SystemAlert, error) {
	return s.repo.ListAlerts(ctx, status, severity, limit)
}

// ListAlertsByService retrieves alerts for a specific service.
func (s *Service) ListAlertsByService(ctx context.Context, serviceName string, limit int) ([]SystemAlert, error) {
	return s.repo.ListAlertsByService(ctx, serviceName, limit)
}

// UpdateAlert updates an alert.
func (s *Service) UpdateAlert(ctx context.Context, alertID string, req UpdateAlertRequest) (*SystemAlert, error) {
	return s.repo.UpdateAlert(ctx, alertID, req)
}

// AcknowledgeAlert acknowledges an alert.
func (s *Service) AcknowledgeAlert(ctx context.Context, alertID, acknowledgedBy string) error {
	return s.repo.AcknowledgeAlert(ctx, alertID, acknowledgedBy)
}

// ResolveAlert resolves an alert.
func (s *Service) ResolveAlert(ctx context.Context, alertID, resolvedBy string) error {
	return s.repo.ResolveAlert(ctx, alertID, resolvedBy)
}

// GetActiveAlerts retrieves all active alerts.
func (s *Service) GetActiveAlerts(ctx context.Context) ([]SystemAlert, error) {
	return s.repo.GetActiveAlerts(ctx)
}

// GetAlertCountsBySeverity returns alert counts grouped by severity.
func (s *Service) GetAlertCountsBySeverity(ctx context.Context) (map[AlertSeverity]int, error) {
	return s.repo.GetAlertCountsBySeverity(ctx)
}

// ============================================================================
// Service Dependency Methods
// ============================================================================

// SaveServiceDependency inserts a ServiceDependency.
func (s *Service) SaveServiceDependency(ctx context.Context, dependency *ServiceDependency) error {
	return s.repo.SaveServiceDependency(ctx, dependency)
}

// GetServiceDependency retrieves a service dependency by ID.
func (s *Service) GetServiceDependency(ctx context.Context, dependencyID string) (*ServiceDependency, error) {
	return s.repo.GetServiceDependency(ctx, dependencyID)
}

// ListServiceDependencies retrieves all dependencies for a service.
func (s *Service) ListServiceDependencies(ctx context.Context, serviceName string) ([]ServiceDependency, error) {
	return s.repo.ListServiceDependencies(ctx, serviceName)
}

// GetDependenciesByService retrieves services that depend on a given service.
func (s *Service) GetDependenciesByService(ctx context.Context, serviceName string) ([]ServiceDependency, error) {
	return s.repo.GetDependenciesByService(ctx, serviceName)
}

// DeleteServiceDependency deletes a service dependency.
func (s *Service) DeleteServiceDependency(ctx context.Context, dependencyID string) error {
	return s.repo.DeleteServiceDependency(ctx, dependencyID)
}

// UpdateServiceDependency updates a service dependency's active status.
func (s *Service) UpdateServiceDependency(ctx context.Context, dependencyID string, isActive bool) error {
	return s.repo.UpdateServiceDependency(ctx, dependencyID, isActive)
}

// ============================================================================
// Status Snapshot Methods
// ============================================================================

// SaveStatusSnapshot inserts a SystemStatusSnapshot.
func (s *Service) SaveStatusSnapshot(ctx context.Context, snapshot *SystemStatusSnapshot) error {
	return s.repo.SaveStatusSnapshot(ctx, snapshot)
}

// GetStatusSnapshot retrieves a status snapshot by ID.
func (s *Service) GetStatusSnapshot(ctx context.Context, snapshotID string) (*SystemStatusSnapshot, error) {
	return s.repo.GetStatusSnapshot(ctx, snapshotID)
}

// GetLatestStatusSnapshot retrieves the most recent status snapshot.
func (s *Service) GetLatestStatusSnapshot(ctx context.Context) (*SystemStatusSnapshot, error) {
	return s.repo.GetLatestStatusSnapshot(ctx)
}

// ListStatusSnapshots retrieves a list of status snapshots.
func (s *Service) ListStatusSnapshots(ctx context.Context, limit int) ([]SystemStatusSnapshot, error) {
	return s.repo.ListStatusSnapshots(ctx, limit)
}

// GetStatusSnapshotsByTimeRange retrieves status snapshots within a time range.
func (s *Service) GetStatusSnapshotsByTimeRange(ctx context.Context, start, end time.Time) ([]SystemStatusSnapshot, error) {
	return s.repo.GetStatusSnapshotsByTimeRange(ctx, start, end)
}

// GetSystemStatusSummary computes a summary of the current system status.
func (s *Service) GetSystemStatusSummary(ctx context.Context) (*SystemStatusSummary, error) {
	return s.repo.GetSystemStatusSummary(ctx)
}
