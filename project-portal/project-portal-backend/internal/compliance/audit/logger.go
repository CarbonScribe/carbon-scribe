package audit

import (
	"time"
)

// AuditLogEntry represents data needed to create an audit log (sub-package local type).
type AuditLogEntry struct {
	EventTime        time.Time
	EventType        string
	EventAction      string
	ActorID          string
	ActorType        string
	ActorIP          string
	TargetType       string
	TargetID         string
	TargetOwnerID    string
	DataCategory     string
	SensitivityLevel string
	ServiceName      string
	Endpoint         string
	HTTPMethod       string
	OldValues        map[string]interface{}
	NewValues        map[string]interface{}
	PermissionUsed   string
	HashChain        string
	Signature        string
}

// LogCreator defines the interface for persisting audit logs.
type LogCreator interface {
	InsertAuditLog(entry AuditLogEntry) error
	GetLastHash() (string, error)
}

// Logger handles audit log creation with hash chain integrity.
type Logger struct {
	immutable *ImmutableLog
}

// NewLogger creates a new audit logger.
func NewLogger() *Logger {
	return &Logger{
		immutable: NewImmutableLog(),
	}
}

// BuildEntry prepares an audit log entry with hash chain linkage and signature.
func (l *Logger) BuildEntry(entry AuditLogEntry, previousHash string) AuditLogEntry {
	if entry.EventTime.IsZero() {
		entry.EventTime = time.Now()
	}
	if entry.SensitivityLevel == "" {
		entry.SensitivityLevel = "normal"
	}

	entry.HashChain = l.immutable.ComputeHash(entry, previousHash)
	entry.Signature = l.immutable.Sign(entry)

	return entry
}
