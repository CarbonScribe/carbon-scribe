package audit

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/compliance"
)

// ExportFormatter formats audit logs for external export.
type ExportFormatter struct{}

// NewExportFormatter creates a new export formatter.
func NewExportFormatter() *ExportFormatter {
	return &ExportFormatter{}
}

// FormatJSON serializes audit logs to pretty-printed JSON.
func (ef *ExportFormatter) FormatJSON(logs []compliance.AuditLog) ([]byte, error) {
	return json.MarshalIndent(logs, "", "  ")
}

// FormatCSV converts audit logs to CSV format.
func (ef *ExportFormatter) FormatCSV(logs []compliance.AuditLog) ([]byte, error) {
	var b strings.Builder
	b.WriteString("log_id,event_time,event_type,event_action,actor_id,actor_type,target_type,target_id,sensitivity_level,service_name,endpoint\n")

	for _, log := range logs {
		b.WriteString(fmt.Sprintf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
			log.LogID,
			log.EventTime.Format(time.RFC3339),
			log.EventType,
			log.EventAction,
			ptrStr(log.ActorID),
			log.ActorType,
			log.TargetType,
			ptrStr(log.TargetID),
			log.SensitivityLevel,
			log.ServiceName,
			log.Endpoint,
		))
	}

	return []byte(b.String()), nil
}

func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
