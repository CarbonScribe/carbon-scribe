package cryptography

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
)

// LogSigner signs and verifies audit log entries using HMAC-SHA256.
type LogSigner struct {
	key []byte
}

// NewLogSigner creates a signer with the given key.
func NewLogSigner(key []byte) *LogSigner {
	return &LogSigner{key: key}
}

// Sign produces an HMAC-SHA256 signature for the given payload.
func (ls *LogSigner) Sign(payload []byte) string {
	mac := hmac.New(sha256.New, ls.key)
	mac.Write(payload)
	return fmt.Sprintf("%x", mac.Sum(nil))
}

// Verify checks that a signature matches the expected HMAC for the payload.
func (ls *LogSigner) Verify(payload []byte, signature string) bool {
	expected := ls.Sign(payload)
	return hmac.Equal([]byte(expected), []byte(signature))
}
