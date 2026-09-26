package ingestion

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// IoTReading represents a sensor reading from an IoT device.
type IoTReading struct {
	ID             string
	ProjectID      string
	SensorID       string
	SensorType     string
	Value          float64
	Unit           string
	Location       *Location
	Metadata       map[string]string
	CapturedAt     time.Time
	IngestedAt     time.Time
	DeviceID       string
	BatteryLevel   *float64
	SignalStrength *int
}

// IoTRequest is the validated input for the IoT pipeline.
type IoTRequest struct {
	ProjectID      string
	SensorID       string
	SensorType     string
	Value          float64
	Unit           string
	Location       *Location
	Metadata       map[string]string
	CapturedAt     time.Time
	DeviceID       string
	BatteryLevel   *float64
	SignalStrength *int
}

// IoTRepository is the persistence contract for IoT data.
type IoTRepository interface {
	SaveIoTReading(ctx context.Context, reading *IoTReading) error
	GetIoTReadingsByProject(ctx context.Context, projectID string, limit int) ([]IoTReading, error)
	GetIoTReadingsBySensor(ctx context.Context, projectID, sensorID string, limit int) ([]IoTReading, error)
	GetIoTReadingsByType(ctx context.Context, projectID, sensorType string, limit int) ([]IoTReading, error)
	GetIoTReadingsByTimeRange(ctx context.Context, projectID string, start, end time.Time) ([]IoTReading, error)
}

// IoTPipeline validates and persists incoming IoT sensor data.
type IoTPipeline struct {
	repo IoTRepository
}

// NewIoTPipeline constructs an IoTPipeline backed by the given repository.
func NewIoTPipeline(repo IoTRepository) *IoTPipeline {
	return &IoTPipeline{repo: repo}
}

// Ingest validates the IoT request and persists an IoTReading.
func (p *IoTPipeline) Ingest(ctx context.Context, req IoTRequest) (*IoTReading, error) {
	if err := validateIoT(req); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	reading := &IoTReading{
		ID:             uuid.NewString(),
		ProjectID:      req.ProjectID,
		SensorID:       strings.ToLower(req.SensorID),
		SensorType:     strings.ToLower(req.SensorType),
		Value:          req.Value,
		Unit:           req.Unit,
		Location:       req.Location,
		Metadata:       req.Metadata,
		CapturedAt:     req.CapturedAt.UTC(),
		IngestedAt:     now,
		DeviceID:       req.DeviceID,
		BatteryLevel:   req.BatteryLevel,
		SignalStrength: req.SignalStrength,
	}

	if err := p.repo.SaveIoTReading(ctx, reading); err != nil {
		return nil, fmt.Errorf("iot ingestion: persist failed: %w", err)
	}

	return reading, nil
}

// validateIoT checks required fields and value constraints.
func validateIoT(req IoTRequest) error {
	if strings.TrimSpace(req.ProjectID) == "" {
		return errors.New("project_id is required")
	}
	if strings.TrimSpace(req.SensorID) == "" {
		return errors.New("sensor_id is required")
	}
	if strings.TrimSpace(req.SensorType) == "" {
		return errors.New("sensor_type is required")
	}
	if req.CapturedAt.IsZero() {
		return errors.New("captured_at is required")
	}
	if req.CapturedAt.After(time.Now().UTC().Add(5 * time.Minute)) {
		return errors.New("captured_at cannot be in the future")
	}

	// Validate sensor type-specific ranges
	switch strings.ToLower(req.SensorType) {
	case "temperature":
		if req.Value < -50 || req.Value > 60 {
			return errors.New("temperature must be in range [-50, 60] °C")
		}
	case "humidity":
		if req.Value < 0 || req.Value > 100 {
			return errors.New("humidity must be in range [0, 100] %")
		}
	case "soil_moisture":
		if req.Value < 0 || req.Value > 100 {
			return errors.New("soil moisture must be in range [0, 100] %")
		}
	case "ph":
		if req.Value < 0 || req.Value > 14 {
			return errors.New("pH must be in range [0, 14]")
		}
	case "co2":
		if req.Value < 0 {
			return errors.New("CO2 must be non-negative")
		}
	case "pm25", "pm10":
		if req.Value < 0 {
			return errors.New("particulate matter must be non-negative")
		}
	case "pressure":
		if req.Value < 0 {
			return errors.New("pressure must be non-negative")
		}
	case "rainfall":
		if req.Value < 0 {
			return errors.New("rainfall must be non-negative")
		}
	case "wind_speed":
		if req.Value < 0 {
			return errors.New("wind speed must be non-negative")
		}
	}

	return nil
}
