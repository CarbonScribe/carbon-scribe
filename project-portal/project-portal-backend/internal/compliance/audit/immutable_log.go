package audit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
)

// ImmutableLog provides cryptographic integrity for audit log entries
// using hash chains and signatures (WORM pattern).
type ImmutableLog struct {
	signingKey []byte
}

// NewImmutableLog creates an immutable log handler.
func NewImmutableLog() *ImmutableLog {
	return &ImmutableLog{
		signingKey: []byte("compliance-audit-signing-key"),
	}
}

// ComputeHash generates the hash chain entry by hashing the current log
// combined with the previous hash, creating tamper-evident linkage.
func (il *ImmutableLog) ComputeHash(entry AuditLogEntry, previousHash string) string {
	data := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		entry.EventTime.UTC().Format("2006-01-02T15:04:05Z"),
		entry.EventType,
		entry.EventAction,
		entry.ServiceName,
		entry.ActorID,
		entry.TargetID,
		previousHash,
	)
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

// Sign produces an HMAC signature of the log entry for tamper detection.
func (il *ImmutableLog) Sign(entry AuditLogEntry) string {
	payload, _ := json.Marshal(map[string]interface{}{
		"event_time":   entry.EventTime.UTC().Format("2006-01-02T15:04:05Z"),
		"event_type":   entry.EventType,
		"event_action": entry.EventAction,
		"service_name": entry.ServiceName,
		"hash_chain":   entry.HashChain,
	})

	mac := hmac.New(sha256.New, il.signingKey)
	mac.Write(payload)
	return fmt.Sprintf("%x", mac.Sum(nil))
}

// VerifyChain validates that a sequence of entries has not been tampered with.
func (il *ImmutableLog) VerifyChain(entries []AuditLogEntry) (bool, int) {
	if len(entries) == 0 {
		return true, 0
	}

	for i := 1; i < len(entries); i++ {
		expectedHash := il.ComputeHash(entries[i], entries[i-1].HashChain)
		if entries[i].HashChain != expectedHash {
			return false, i
		}
	}
	return true, -1
}

// VerifySignature checks the HMAC signature of a single entry.
func (il *ImmutableLog) VerifySignature(entry AuditLogEntry) bool {
	expected := il.Sign(entry)
	return hmac.Equal([]byte(entry.Signature), []byte(expected))
}
