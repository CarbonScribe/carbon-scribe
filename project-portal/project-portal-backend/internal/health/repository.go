package health

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// Repository defines the interface for health metrics data access
type Repository interface {
	// System Metric
	CreateSystemMetric(ctx context.Context, metric *SystemMetric) error
	QuerySystemMetrics(ctx context.Context, query MetricQuery) ([]SystemMetric, error)

	// Status
	PingDB(ctx context.Context) error

	// Service
	ListServiceHealthChecks(ctx context.Context) ([]ServiceHealthCheck, error)

	// Check
	CreateServiceHealthCheck(ctx context.Context, check *ServiceHealthCheck) error

	// System Alerts
	GetSystemAlertByID(ctx context.Context, id string) (*SystemAlert, error)
	QuerySystemAlerts(ctx context.Context, query AlertQuery) ([]SystemAlert, error)
	UpdateSystemAlert(ctx context.Context, alert *SystemAlert) error

	// Reports
	GetLatestSnapshot(ctx context.Context, snapshotType string) (*SystemStatusSnapshot, error)

	// Dependencies
	ListServiceDependencies(ctx context.Context) ([]ServiceDependency, error)

	// Uptime
	CalculateUptimePercentage(ctx context.Context, serviceName string, startTime time.Time) (float64, error)
}

// repository implements the Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new health metrics repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// ========== System metrics ==========

func (r *repository) CreateSystemMetric(ctx context.Context, metric *SystemMetric) error {
	return r.db.WithContext(ctx).Create(metric).Error
}

func (r *repository) QuerySystemMetrics(ctx context.Context, query MetricQuery) ([]SystemMetric, error) {
	var metrics []SystemMetric
	db := r.db.WithContext(ctx)

	if query.MetricName != "" {
		db = db.Where("metric_name = ?", query.MetricName)
	}
	if query.MetricType != "" {
		db = db.Where("metric_type = ?", query.MetricType)
	}
	if query.ServiceName != "" {
		db = db.Where("service_name = ?", query.ServiceName)
	}
	if query.Endpoint != "" {
		db = db.Where("endpoint = ?", query.Endpoint)
	}
	if query.InstanceID != "" {
		db = db.Where("instance_id = ?", query.InstanceID)
	}
	if query.Region != "" {
		db = db.Where("region = ?", query.Region)
	}
	if !query.StartTime.IsZero() {
		db = db.Where("time >= ?", query.StartTime)
	}
	if !query.EndTime.IsZero() {
		db = db.Where("time <= ?", query.EndTime)
	}

	err := db.Order("time DESC").Limit(query.Limit).Find(&metrics).Error
	return metrics, err
}

func (r *repository) PingDB(ctx context.Context) error {
	sqlDB, err := r.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

func (r *repository) ListServiceHealthChecks(ctx context.Context) ([]ServiceHealthCheck, error) {
	var checks []ServiceHealthCheck
	err := r.db.Find(&checks).Error
	return checks, err
}

func (r *repository) CreateServiceHealthCheck(ctx context.Context, check *ServiceHealthCheck) error {
	return r.db.Create(check).Error
}

// ========== System alerts ==========

func (r *repository) QuerySystemAlerts(ctx context.Context, query AlertQuery) ([]SystemAlert, error) {
	var alerts []SystemAlert
	db := r.db.WithContext(ctx)

	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.Severity != "" {
		db = db.Where("alert_severity = ?", query.Severity)
	}
	if query.ServiceName != "" {
		db = db.Where("service_name = ?", query.ServiceName)
	}
	if query.AlertSource != "" {
		db = db.Where("alert_source = ?", query.AlertSource)
	}
	if !query.StartTime.IsZero() {
		db = db.Where("fired_at >= ?", query.StartTime)
	}
	if !query.EndTime.IsZero() {
		db = db.Where("fired_at <= ?", query.EndTime)
	}

	err := db.Order("fired_at DESC").Limit(query.Limit).Find(&alerts).Error
	return alerts, err
}

func (r *repository) UpdateSystemAlert(ctx context.Context, alert *SystemAlert) error {
	return r.db.WithContext(ctx).Save(alert).Error
}

func (r *repository) GetSystemAlertByID(ctx context.Context, id string) (*SystemAlert, error) {
	var alert SystemAlert
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&alert).Error
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

// ========== Reports ==========

func (r *repository) GetLatestSnapshot(ctx context.Context, snapshotType string) (*SystemStatusSnapshot, error) {
	var snapshot SystemStatusSnapshot
	err := r.db.WithContext(ctx).
		Where("snapshot_type = ?", snapshotType).
		Order("snapshot_time DESC").
		First(&snapshot).Error
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

// ========== Dependencies ==========

func (r *repository) ListServiceDependencies(ctx context.Context) ([]ServiceDependency, error) {
	var dependencies []ServiceDependency
	err := r.db.WithContext(ctx).Find(&dependencies).Error
	return dependencies, err
}

// ========== Uptime ==========

func (r *repository) CalculateUptimePercentage(ctx context.Context, serviceName string, startTime time.Time) (float64, error) {
	var stats struct {
		Total   int64
		Success int64
	}

	// Join health_check_results with service_health_checks to filter by service_name
	err := r.db.WithContext(ctx).
		Table("health_check_results").
		Select("COUNT(*) as total, COUNT(*) FILTER (WHERE success = true) as success").
		Joins("JOIN service_health_checks ON health_check_results.check_id = service_health_checks.id").
		Where("service_health_checks.service_name = ? AND health_check_results.check_time >= ?", serviceName, startTime).
		Scan(&stats).Error

	if err != nil {
		return 0, err
	}

	if stats.Total == 0 {
		return 100.0, nil // Default to 100% if no data
	}

	return float64(stats.Success) * 100.0 / float64(stats.Total), nil
}
