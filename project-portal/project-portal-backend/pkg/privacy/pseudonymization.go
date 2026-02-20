package privacy

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
)

// Pseudonymizer replaces identifiers with reversible tokens.
// Unlike anonymization, pseudonymized data can be re-identified with the key.
type Pseudonymizer struct {
	key []byte
}

// NewPseudonymizer creates a pseudonymizer. The key must be 16, 24, or 32 bytes for AES.
func NewPseudonymizer(key []byte) (*Pseudonymizer, error) {
	if l := len(key); l != 16 && l != 24 && l != 32 {
		return nil, fmt.Errorf("key must be 16, 24, or 32 bytes; got %d", l)
	}
	return &Pseudonymizer{key: key}, nil
}

// Pseudonymize encrypts an identifier, producing a hex-encoded token.
func (p *Pseudonymizer) Pseudonymize(identifier string) (string, error) {
	block, err := aes.NewCipher(p.key)
	if err != nil {
		return "", fmt.Errorf("creating cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating GCM: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generating nonce: %w", err)
	}

	ciphertext := aesGCM.Seal(nonce, nonce, []byte(identifier), nil)
	return hex.EncodeToString(ciphertext), nil
}

// Depseudonymize decrypts a hex-encoded token back to the original identifier.
func (p *Pseudonymizer) Depseudonymize(token string) (string, error) {
	data, err := hex.DecodeString(token)
	if err != nil {
		return "", fmt.Errorf("decoding token: %w", err)
	}

	block, err := aes.NewCipher(p.key)
	if err != nil {
		return "", fmt.Errorf("creating cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating GCM: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypting: %w", err)
	}

	return string(plaintext), nil
}
