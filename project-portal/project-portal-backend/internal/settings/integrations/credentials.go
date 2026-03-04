package integrations

import "carbon-scribe/project-portal/project-portal-backend/pkg/encryption"

func EncryptConfig(v encryption.SecureStorage, plaintext string) (string, error) {
	return v.EncryptString(plaintext)
}

func DecryptConfig(v encryption.SecureStorage, ciphertext string) (string, error) {
	return v.DecryptString(ciphertext)
}
