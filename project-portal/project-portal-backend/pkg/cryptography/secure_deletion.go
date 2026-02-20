package cryptography

import (
	"crypto/rand"
	"fmt"
)

// SecureDeletion provides utilities for cryptographic erasure of sensitive data.
type SecureDeletion struct{}

// NewSecureDeletion creates a new secure deletion utility.
func NewSecureDeletion() *SecureDeletion {
	return &SecureDeletion{}
}

// GenerateOverwriteData creates random bytes for overwriting sensitive data.
func (sd *SecureDeletion) GenerateOverwriteData(size int) ([]byte, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return nil, fmt.Errorf("generating random data: %w", err)
	}
	return data, nil
}

// CreateDeletionToken generates a cryptographically secure token proving deletion occurred.
func (sd *SecureDeletion) CreateDeletionToken(entityID, entityType string) (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", fmt.Errorf("generating deletion token: %w", err)
	}
	return fmt.Sprintf("del_%s_%s_%x", entityType, entityID[:8], token), nil
}
