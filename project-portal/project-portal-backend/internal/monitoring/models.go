package monitoring

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// JSONB is a custom type for PostgreSQL JSONB columns
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// =============================================
// SATELLITE OBSERVATION MODELS
// =============================================

// SatelliteObservation represents a single satellite data point
type SatelliteObservation struct {
	Time                  time.Time `json:"time" db:"time"`
	ProjectID             uuid.UUID `json:"project_id" db:"project_id"`
	SatelliteSource       string    `json:"satellite_source" db:"satellite_source" binding:"required,oneof=sentinel2 planet landsat modis"`
	TileID                *string   `json:"tile_id,omitempty" db:"tile_id"`
	NDVI                  *float64  `json:"ndvi,omitempty" db:"ndvi"`
	EVI                   *float64  `json:"evi,omitempty" db:"evi"`
	NDWI                  *float64  `json:"ndwi,omitempty" db:"ndwi"`
	SAVI                  *float64  `json:"savi,omitempty" db:"savi"`
	BiomassKgPerHa        *float64  `json:"biomass_kg_per_ha,omitempty" db:"biomass_kg_per_ha"`
	CloudCoveragePercent  *float64  `json:"cloud_coverage_percent,omitempty" db:"cloud_coverage_percent"`
	DataQualityScore      *float64  `json:"data_quality_score,omitempty" db:"data_quality_score"`
	Geometry              *string   `json:"geometry,omitempty" db:"geometry"` // PostGIS geometry as WKT or GeoJSON
	RawBands              JSONB     `json:"raw_bands,omitempty" db:"raw_bands"`
	Metadata              JSONB     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
}

// SatelliteWebhookPayload represents incoming webhook data from satellite providers
type SatelliteWebhookPayload struct {
	Source      string                 `json:"source" binding:"required"`
	TileID      string                 `json:"tile_id" binding:"required"`
	AcquisitionTime time.Time          `json:"acquisition_time" binding:"required"`
	ProjectID   *uuid.UUID             `json:"project_id,omitempty"`
	Bands       map[string]float64     `json:"bands"` // e.g., {"red": 0.15, "nir": 0.45}
	CloudCover  float64                `json:"cloud_cover"`
	Quality     float64                `json:"quality"`
	Geometry    interface{}            `json:"geometry"` // GeoJSON geometry
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// SatelliteObservationQuery represents query parameters for satellite data
type SatelliteObservationQuery struct {
	ProjectID       uuid.UUID `form:"project_id" binding:"required"`
	StartTime       time.Time `form:"start_time" binding:"required"`
	EndTime         time.Time `form:"end_time" binding:"required"`
	SatelliteSource *string   `form:"satellite_source"`
	MinQuality      *float64  `form:"min_quality"`
	MaxCloudCover   *float64  `form:"max_cloud_cover"`
	Limit           int       `form:"limit" binding:"omitempty,min=1,max=1000"`
	Offset          int       `form:"offset" binding:"omitempty,min=0"`
}

// =============================================
// IOT SENSOR MODELS
// =============================================

// SensorReading represents a single IoT sensor measurement
type SensorReading struct {
	Time           time.Time `json:"time" db:"time"`
	ProjectID      uuid.UUID `json:"project_id" db:"project_id"`
	SensorID       string    `json:"sensor_id" db:"sensor_id" binding:"required"`
	SensorType     string    `json:"sensor_type" db:"sensor_type" binding:"required"`
	Value          float64   `json:"value" db:"value" binding:"required"`
	Unit           string    `json:"unit" db:"unit" binding:"required"`
	Latitude       *float64  `json:"latitude,omitempty" db:"latitude"`
	Longitude      *float64  `json:"longitude,omitempty" db:"longitude"`
	AltitudeM      *float64  `json:"altitude_m,omitempty" db:"altitude_m"`
	BatteryLevel   *float64  `json:"battery_level,omitempty" db:"battery_level"`
	SignalStrength *int      `json:"signal_strength,omitempty" db:"signal_strength"`
	DataQuality    string    `json:"data_quality" db:"data_quality"`
	Metadata       JSONB     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// SensorReadingBatch represents multiple sensor readings uploaded together
type SensorReadingBatch struct {
	Readings []SensorReading `json:"readings" binding:"required,dive"`
}

// Sensor represents a registered IoT sensor device
type Sensor struct {
	ID                       uuid.UUID  `json:"id" db:"id"`
	SensorID                 string     `json:"sensor_id" db:"sensor_id" binding:"required"`
	ProjectID                uuid.UUID  `json:"project_id" db:"project_id" binding:"required"`
	Name                     string     `json:"name" db:"name" binding:"required"`
	SensorType               string     `json:"sensor_type" db:"sensor_type" binding:"required"`
	Manufacturer             *string    `json:"manufacturer,omitempty" db:"manufacturer"`
	Model                    *string    `json:"model,omitempty" db:"model"`
	FirmwareVersion          *string    `json:"firmware_version,omitempty" db:"firmware_version"`
	InstallationDate         *time.Time `json:"installation_date,omitempty" db:"installation_date"`
	Latitude                 float64    `json:"latitude" db:"latitude" binding:"required"`
	Longitude                float64    `json:"longitude" db:"longitude" binding:"required"`
	AltitudeM                *float64   `json:"altitude_m,omitempty" db:"altitude_m"`
	DepthCm                  *float64   `json:"depth_cm,omitempty" db:"depth_cm"`
	CalibrationData          JSONB      `json:"calibration_data,omitempty" db:"calibration_data"`
	CommunicationProtocol    string     `json:"communication_protocol" db:"communication_protocol"`
	ReportingIntervalSeconds int        `json:"reporting_interval_seconds" db:"reporting_interval_seconds"`
	Status                   string     `json:"status" db:"status"`
	LastSeenAt               *time.Time `json:"last_seen_at,omitempty" db:"last_seen_at"`
	Metadata                 JSONB      `json:"metadata,omitempty" db:"metadata"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at" db:"updated_at"`
}

// SensorRegistrationRequest represents a request to register a new sensor
type SensorRegistrationRequest struct {
	SensorID                 string                 `json:"sensor_id" binding:"required"`
	ProjectID                uuid.UUID              `json:"project_id" binding:"required"`
	Name                     string                 `json:"name" binding:"required"`
	SensorType               string                 `json:"sensor_type" binding:"required"`
	Latitude                 float64                `json:"latitude" binding:"required"`
	Longitude                float64                `json:"longitude" binding:"required"`
	CommunicationProtocol    string                 `json:"communication_protocol" binding:"required"`
	Manufacturer             *string                `json:"manufacturer,omitempty"`
	Model                    *string                `json:"model,omitempty"`
	FirmwareVersion          *string                `json:"firmware_version,omitempty"`
	InstallationDate         *time.Time             `json:"installation_date,omitempty"`
	AltitudeM                *float64               `json:"altitude_m,omitempty"`
	DepthCm                  *float64               `json:"depth_cm,omitempty"`
	CalibrationData          map[string]interface{} `json:"calibration_data,omitempty"`
	ReportingIntervalSeconds int                    `json:"reporting_interval_seconds" binding:"omitempty,min=1"`
	Metadata                 map[string]interface{} `json:"metadata,omitempty"`
}

// =============================================
// PROJECT METRICS MODELS
// =============================================

// ProjectMetric represents a calculated metric for a project
type ProjectMetric struct {
	Time               time.Time `json:"time" db:"time"`
	ProjectID          uuid.UUID `json:"project_id" db:"project_id"`
	MetricName         string    `json:"metric_name" db:"metric_name" binding:"required"`
	Value              float64   `json:"value" db:"value" binding:"required"`
	AggregationPeriod  string    `json:"aggregation_period" db:"aggregation_period" binding:"required,oneof=raw hourly daily weekly monthly"`
	CalculationMethod  *string   `json:"calculation_method,omitempty" db:"calculation_method"`
	ConfidenceScore    *float64  `json:"confidence_score,omitempty" db:"confidence_score"`
	Unit               *string   `json:"unit,omitempty" db:"unit"`
	Metadata           JSONB     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
}

// MetricsQuery represents query parameters for project metrics
type MetricsQuery struct {
	ProjectID         uuid.UUID `form:"project_id" binding:"required"`
	StartTime         time.Time `form:"start_time" binding:"required"`
	EndTime           time.Time `form:"end_time" binding:"required"`
	MetricName        *string   `form:"metric_name"`
	AggregationPeriod string    `form:"aggregation_period" binding:"omitempty,oneof=raw hourly daily weekly monthly"`
	Limit             int       `form:"limit" binding:"omitempty,min=1,max=10000"`
	Offset            int       `form:"offset" binding:"omitempty,min=0"`
}

// PerformanceDashboard represents comprehensive project performance metrics
type PerformanceDashboard struct {
	ProjectID              uuid.UUID                `json:"project_id"`
	Period                 string                   `json:"period"` // e.g., "2024-01"
	CarbonSequestration    CarbonMetrics            `json:"carbon_sequestration"`
	VegetationHealth       VegetationMetrics        `json:"vegetation_health"`
	SoilHealth             SoilMetrics              `json:"soil_health"`
	WaterRetention         WaterMetrics             `json:"water_retention"`
	BiodiversityIndicators BiodiversityMetrics      `json:"biodiversity_indicators"`
	Trends                 map[string]TrendAnalysis `json:"trends"`
	Alerts                 []Alert                  `json:"active_alerts"`
	GeneratedAt            time.Time                `json:"generated_at"`
}

type CarbonMetrics struct {
	DailyRateKgCO2  float64 `json:"daily_rate_kg_co2"`
	MonthlyTotalKg  float64 `json:"monthly_total_kg"`
	YearlyTotalKg   float64 `json:"yearly_total_kg"`
	ConfidenceScore float64 `json:"confidence_score"`
}

type VegetationMetrics struct {
	AverageNDVI      float64 `json:"average_ndvi"`
	BiomassKgPerHa   float64 `json:"biomass_kg_per_ha"`
	CanopyCoverage   float64 `json:"canopy_coverage_percent"`
	VegetationTrend  string  `json:"vegetation_trend"` // "improving", "stable", "declining"
}

type SoilMetrics struct {
	AverageMoisture  float64 `json:"average_moisture_percent"`
	AveragePH        float64 `json:"average_ph"`
	OrganicMatter    float64 `json:"organic_matter_percent"`
	TemperatureCelsius float64 `json:"temperature_celsius"`
}

type WaterMetrics struct {
	RainfallMm          float64 `json:"rainfall_mm"`
	NDWI                float64 `json:"ndwi"`
	SoilWaterContent    float64 `json:"soil_water_content_percent"`
}

type BiodiversityMetrics struct {
	SpeciesCount     int     `json:"species_count"`
	ShannonsIndex    float64 `json:"shannons_index"`
	PollinatorActivity float64 `json:"pollinator_activity_index"`
}

type TrendAnalysis struct {
	MetricName      string    `json:"metric_name"`
	Direction       string    `json:"direction"` // "up", "down", "stable"
	ChangePercent   float64   `json:"change_percent"`
	Significance    string    `json:"significance"` // "significant", "not_significant"
	PValue          *float64  `json:"p_value,omitempty"`
	ForecastedValue *float64  `json:"forecasted_value,omitempty"`
}

// =============================================
// ALERT MODELS
// =============================================

// AlertRule represents a monitoring alert rule
type AlertRule struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	ProjectID            *uuid.UUID `json:"project_id,omitempty" db:"project_id"`
	Name                 string     `json:"name" db:"name" binding:"required"`
	Description          *string    `json:"description,omitempty" db:"description"`
	ConditionType        string     `json:"condition_type" db:"condition_type" binding:"required,oneof=threshold rate_of_change data_gap anomaly"`
	MetricSource         string     `json:"metric_source" db:"metric_source" binding:"required,oneof=satellite sensor calculated"`
	MetricName           string     `json:"metric_name" db:"metric_name" binding:"required"`
	SensorType           *string    `json:"sensor_type,omitempty" db:"sensor_type"`
	ConditionConfig      JSONB      `json:"condition_config" db:"condition_config" binding:"required"`
	Severity             string     `json:"severity" db:"severity" binding:"required,oneof=low medium high critical"`
	NotificationChannels JSONB      `json:"notification_channels" db:"notification_channels"`
	CooldownMinutes      int        `json:"cooldown_minutes" db:"cooldown_minutes"`
	IsActive             bool       `json:"is_active" db:"is_active"`
	CreatedBy            *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// AlertRuleRequest represents a request to create/update an alert rule
type AlertRuleRequest struct {
	ProjectID            *uuid.UUID             `json:"project_id,omitempty"`
	Name                 string                 `json:"name" binding:"required"`
	Description          *string                `json:"description,omitempty"`
	ConditionType        string                 `json:"condition_type" binding:"required,oneof=threshold rate_of_change data_gap anomaly"`
	MetricSource         string                 `json:"metric_source" binding:"required,oneof=satellite sensor calculated"`
	MetricName           string                 `json:"metric_name" binding:"required"`
	SensorType           *string                `json:"sensor_type,omitempty"`
	ConditionConfig      map[string]interface{} `json:"condition_config" binding:"required"`
	Severity             string                 `json:"severity" binding:"required,oneof=low medium high critical"`
	NotificationChannels []string               `json:"notification_channels" binding:"required"`
	CooldownMinutes      int                    `json:"cooldown_minutes" binding:"omitempty,min=0"`
}

// Alert represents a triggered alert
type Alert struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	RuleID               *uuid.UUID `json:"rule_id,omitempty" db:"rule_id"`
	ProjectID            uuid.UUID  `json:"project_id" db:"project_id"`
	TriggerTime          time.Time  `json:"trigger_time" db:"trigger_time"`
	ResolvedTime         *time.Time `json:"resolved_time,omitempty" db:"resolved_time"`
	Severity             string     `json:"severity" db:"severity"`
	Title                string     `json:"title" db:"title"`
	Message              string     `json:"message" db:"message"`
	Details              JSONB      `json:"details,omitempty" db:"details"`
	Status               string     `json:"status" db:"status"`
	AcknowledgedBy       *uuid.UUID `json:"acknowledged_by,omitempty" db:"acknowledged_by"`
	AcknowledgedAt       *time.Time `json:"acknowledged_at,omitempty" db:"acknowledged_at"`
	ResolvedBy           *uuid.UUID `json:"resolved_by,omitempty" db:"resolved_by"`
	ResolutionNotes      *string    `json:"resolution_notes,omitempty" db:"resolution_notes"`
	NotificationSent     bool       `json:"notification_sent" db:"notification_sent"`
	NotificationAttempts int        `json:"notification_attempts" db:"notification_attempts"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// AlertAcknowledgeRequest represents a request to acknowledge an alert
type AlertAcknowledgeRequest struct {
	AcknowledgedBy uuid.UUID `json:"acknowledged_by" binding:"required"`
	Notes          *string   `json:"notes,omitempty"`
}

// AlertResolveRequest represents a request to resolve an alert
type AlertResolveRequest struct {
	ResolvedBy      uuid.UUID `json:"resolved_by" binding:"required"`
	ResolutionNotes string    `json:"resolution_notes" binding:"required"`
}

// AlertQuery represents query parameters for alerts
type AlertQuery struct {
	ProjectID  *uuid.UUID `form:"project_id"`
	Status     *string    `form:"status"`
	Severity   *string    `form:"severity"`
	StartTime  *time.Time `form:"start_time"`
	EndTime    *time.Time `form:"end_time"`
	Limit      int        `form:"limit" binding:"omitempty,min=1,max=1000"`
	Offset     int        `form:"offset" binding:"omitempty,min=0"`
}

// =============================================
// WEBSOCKET MODELS
// =============================================

// WebSocketMessage represents real-time data pushed via WebSocket
type WebSocketMessage struct {
	Type      string      `json:"type"` // "sensor_reading", "satellite_observation", "alert", "metric"
	Timestamp time.Time   `json:"timestamp"`
	ProjectID uuid.UUID   `json:"project_id"`
	Data      interface{} `json:"data"`
}

// WebSocketSubscription represents a client subscription
type WebSocketSubscription struct {
	ClientID  string      `json:"client_id"`
	ProjectID uuid.UUID   `json:"project_id"`
	DataTypes []string    `json:"data_types"` // ["sensor", "satellite", "alerts"]
	Filters   JSONB       `json:"filters,omitempty"`
}
