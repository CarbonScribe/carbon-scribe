package encryption

import "testing"

func TestVaultEncryptDecrypt(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	v, err := NewVault(key)
	if err != nil {
		t.Fatalf("NewVault error: %v", err)
	}

	ciphertext, err := v.EncryptString("secret-value")
	if err != nil {
		t.Fatalf("EncryptString error: %v", err)
	}
	if ciphertext == "" || ciphertext == "secret-value" {
		t.Fatalf("expected ciphertext to be non-empty and encrypted")
	}

	plaintext, err := v.DecryptString(ciphertext)
	if err != nil {
		t.Fatalf("DecryptString error: %v", err)
	}
	if plaintext != "secret-value" {
		t.Fatalf("unexpected plaintext: %s", plaintext)
	}
}
