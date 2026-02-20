package audit

import (
	"time"
)

// Reporter generates compliance reports from audit data.
type Reporter struct {
	detector *AnomalyDetector
}

// NewReporter creates a new compliance reporter.
func NewReporter() *Reporter {
	return &Reporter{
		detector: NewAnomalyDetector(),
	}
}

// ComplianceReport contains a comprehensive compliance status report.
type ComplianceReport struct {
	GeneratedAt    time.Time      `json:"generated_at"`
	Period         ReportPeriod   `json:"period"`
	Anomalies      []Anomaly      `json:"anomalies"`
	IntegrityCheck IntegrityResult `json:"integrity_check"`
}

// ReportPeriod defines the time range for a report.
type ReportPeriod struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// IntegrityResult captures the outcome of an audit log integrity check.
type IntegrityResult struct {
	Valid         bool  `json:"valid"`
	TotalLogs     int64 `json:"total_logs"`
	CheckedLogs   int   `json:"checked_logs"`
	FailedAtIndex int   `json:"failed_at_index,omitempty"`
}

// BuildReport creates a compliance report skeleton.
func (r *Reporter) BuildReport(start, end time.Time, totalLogs int64) *ComplianceReport {
	return &ComplianceReport{
		GeneratedAt: time.Now(),
		Period: ReportPeriod{
			Start: start,
			End:   end,
		},
		Anomalies: []Anomaly{},
		IntegrityCheck: IntegrityResult{
			Valid:       true,
			TotalLogs:  totalLogs,
			CheckedLogs: 0,
		},
	}
}

// AddAnomalies appends detected anomalies to the report.
func (r *Reporter) AddAnomalies(report *ComplianceReport, anomalies []Anomaly) {
	report.Anomalies = append(report.Anomalies, anomalies...)
}
