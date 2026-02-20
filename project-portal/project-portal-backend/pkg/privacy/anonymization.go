package privacy

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// Anonymizer provides standalone anonymization functions for use across services.
type Anonymizer struct {
	salt string
}

// NewAnonymizer creates an anonymizer with a salt for consistent pseudonymization.
func NewAnonymizer(salt string) *Anonymizer {
	return &Anonymizer{salt: salt}
}

// AnonymizeEmail replaces the local part with a hash, keeping the domain.
func (a *Anonymizer) AnonymizeEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return a.Hash(email)
	}
	return fmt.Sprintf("%s@%s", a.Hash(parts[0])[:8], parts[1])
}

// AnonymizeName replaces a name with a hash prefix.
func (a *Anonymizer) AnonymizeName(name string) string {
	if len(name) == 0 {
		return "***"
	}
	return string(name[0]) + "***"
}

// Hash produces a deterministic SHA-256 hash of the input using the salt.
func (a *Anonymizer) Hash(value string) string {
	h := sha256.Sum256([]byte(a.salt + value))
	return fmt.Sprintf("%x", h)
}

// RedactField returns a redacted placeholder.
func (a *Anonymizer) RedactField() string {
	return "[REDACTED]"
}
