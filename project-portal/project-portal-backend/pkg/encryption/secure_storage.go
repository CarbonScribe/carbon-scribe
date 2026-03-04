package encryption

type SecureStorage interface {
	EncryptString(plaintext string) (string, error)
	DecryptString(ciphertext string) (string, error)
}
