package api

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

func GenerateSecret(prefix string) (string, string, string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", "", "", err
	}
	random := base64.RawURLEncoding.EncodeToString(buf)
	secret := fmt.Sprintf("%s_%s", prefix, random)
	last4 := secret
	if len(last4) > 4 {
		last4 = last4[len(last4)-4:]
	}
	keyPrefix := secret
	if len(keyPrefix) > 8 {
		keyPrefix = keyPrefix[:8]
	}
	return secret, keyPrefix, last4, nil
}
