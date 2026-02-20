package retention

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// Anonymizer provides data anonymization and pseudonymization utilities.
type Anonymizer struct{}

// NewAnonymizer creates a new Anonymizer.
func NewAnonymizer() *Anonymizer {
	return &Anonymizer{}
}

// AnonymizeEmail replaces an email with a hashed version preserving domain structure.
func (a *Anonymizer) AnonymizeEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return a.HashValue(email)
	}
	return fmt.Sprintf("%s@%s", a.HashValue(parts[0])[:8], parts[1])
}

// AnonymizeName replaces a name with asterisks, keeping the first character.
func (a *Anonymizer) AnonymizeName(name string) string {
	if len(name) <= 1 {
		return "***"
	}
	return string(name[0]) + strings.Repeat("*", len(name)-1)
}

// AnonymizeIP anonymizes an IP address by zeroing the last octet (IPv4) or last 80 bits (IPv6).
func (a *Anonymizer) AnonymizeIP(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) == 4 {
		return fmt.Sprintf("%s.%s.%s.0", parts[0], parts[1], parts[2])
	}
	// IPv6: truncate to /48
	colonParts := strings.Split(ip, ":")
	if len(colonParts) >= 3 {
		return fmt.Sprintf("%s:%s:%s::0", colonParts[0], colonParts[1], colonParts[2])
	}
	return "0.0.0.0"
}

// HashValue creates a deterministic one-way hash (pseudonymization).
func (a *Anonymizer) HashValue(value string) string {
	h := sha256.Sum256([]byte(value))
	return fmt.Sprintf("%x", h)
}

// AnonymizeRecord applies anonymization rules to a map of field values.
func (a *Anonymizer) AnonymizeRecord(data map[string]interface{}, rules map[string]string) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range data {
		rule, hasRule := rules[k]
		if !hasRule {
			result[k] = v
			continue
		}

		strVal, ok := v.(string)
		if !ok {
			result[k] = v
			continue
		}

		switch rule {
		case "hash":
			result[k] = a.HashValue(strVal)
		case "email":
			result[k] = a.AnonymizeEmail(strVal)
		case "name":
			result[k] = a.AnonymizeName(strVal)
		case "ip":
			result[k] = a.AnonymizeIP(strVal)
		case "redact":
			result[k] = "[REDACTED]"
		case "remove":
			// skip field entirely
		default:
			result[k] = v
		}
	}
	return result
}
