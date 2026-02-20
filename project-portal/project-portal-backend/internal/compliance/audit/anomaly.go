package audit

import (
	"time"
)

// AnomalyDetector identifies unusual data access patterns.
type AnomalyDetector struct {
	thresholds AnomalyThresholds
}

// AnomalyThresholds configures detection sensitivity.
type AnomalyThresholds struct {
	MaxAccessPerHour       int     `json:"max_access_per_hour"`
	MaxSensitivePerDay     int     `json:"max_sensitive_per_day"`
	UnusualHoursStart      int     `json:"unusual_hours_start"`
	UnusualHoursEnd        int     `json:"unusual_hours_end"`
	AccessVolumeMultiplier float64 `json:"access_volume_multiplier"`
}

// Anomaly represents a detected unusual access pattern.
type Anomaly struct {
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	Description string                 `json:"description"`
	ActorID     string                 `json:"actor_id"`
	DetectedAt  time.Time              `json:"detected_at"`
	Details     map[string]interface{} `json:"details"`
}

// NewAnomalyDetector creates a detector with default thresholds.
func NewAnomalyDetector() *AnomalyDetector {
	return &AnomalyDetector{
		thresholds: AnomalyThresholds{
			MaxAccessPerHour:       100,
			MaxSensitivePerDay:     20,
			UnusualHoursStart:      22,
			UnusualHoursEnd:        6,
			AccessVolumeMultiplier: 3.0,
		},
	}
}

// AnalyzeAccessVolume checks if the access count exceeds the hourly threshold.
func (ad *AnomalyDetector) AnalyzeAccessVolume(accessCount int64) *Anomaly {
	if accessCount > int64(ad.thresholds.MaxAccessPerHour) {
		return &Anomaly{
			Type:        "high_volume_access",
			Severity:    "medium",
			Description: "Unusually high data access volume detected",
			DetectedAt:  time.Now(),
			Details: map[string]interface{}{
				"access_count": accessCount,
				"threshold":    ad.thresholds.MaxAccessPerHour,
			},
		}
	}
	return nil
}

// AnalyzeUnusualHours checks if current access is during unusual hours.
func (ad *AnomalyDetector) AnalyzeUnusualHours(accessCount int64) *Anomaly {
	hour := time.Now().Hour()
	isUnusual := hour >= ad.thresholds.UnusualHoursStart || hour < ad.thresholds.UnusualHoursEnd

	if isUnusual && accessCount > 0 {
		return &Anomaly{
			Type:        "unusual_hours_access",
			Severity:    "low",
			Description: "Sensitive data accessed during unusual hours",
			DetectedAt:  time.Now(),
			Details: map[string]interface{}{
				"access_count": accessCount,
				"hour":         hour,
			},
		}
	}
	return nil
}

// AnalyzeSensitiveSpike checks if sensitive data access exceeds daily threshold.
func (ad *AnomalyDetector) AnalyzeSensitiveSpike(sensitiveAccessCount int64) *Anomaly {
	if sensitiveAccessCount > int64(ad.thresholds.MaxSensitivePerDay) {
		return &Anomaly{
			Type:        "sensitive_access_spike",
			Severity:    "high",
			Description: "High volume of highly sensitive data access in the last 24 hours",
			DetectedAt:  time.Now(),
			Details: map[string]interface{}{
				"access_count": sensitiveAccessCount,
				"threshold":    ad.thresholds.MaxSensitivePerDay,
			},
		}
	}
	return nil
}
