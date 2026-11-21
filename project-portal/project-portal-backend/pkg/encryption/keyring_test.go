package encryption

import "testing"

func key32(fill byte) []byte {
	k := make([]byte, 32)
	for i := range k {
		k[i] = fill
	}
	return k
}

func TestKeyring_EncryptDecryptRoundTrip(t *testing.T) {
	kr, err := NewKeyring(1, map[int][]byte{1: key32(1)})
	if err != nil {
		t.Fatalf("NewKeyring: %v", err)
	}

	ciphertext, version, err := kr.Encrypt("super-secret-api-key")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if version != 1 {
		t.Fatalf("expected version 1, got %d", version)
	}
	if ciphertext == "super-secret-api-key" {
		t.Fatal("ciphertext must not equal plaintext")
	}

	plaintext, err := kr.Decrypt(ciphertext, version)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if plaintext != "super-secret-api-key" {
		t.Fatalf("expected round-trip plaintext, got %q", plaintext)
	}
}

func TestKeyring_DecryptWithWrongKeyFails(t *testing.T) {
	kr1, _ := NewKeyring(1, map[int][]byte{1: key32(1)})
	kr2, _ := NewKeyring(1, map[int][]byte{1: key32(2)})

	ciphertext, version, err := kr1.Encrypt("secret")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	if _, err := kr2.Decrypt(ciphertext, version); err == nil {
		t.Fatal("expected decryption with the wrong key to fail")
	}
}

func TestKeyring_DecryptUnknownVersionFails(t *testing.T) {
	kr, _ := NewKeyring(1, map[int][]byte{1: key32(1)})

	if _, err := kr.Decrypt("anything", 99); err == nil {
		t.Fatal("expected decrypting an unconfigured key version to fail")
	}
}

func TestKeyring_RotateReencryptsWithCurrentVersion(t *testing.T) {
	kr, err := NewKeyring(2, map[int][]byte{
		1: key32(1),
		2: key32(2),
	})
	if err != nil {
		t.Fatalf("NewKeyring: %v", err)
	}

	// Simulate a row encrypted before rotation, under version 1.
	oldKeyring, _ := NewKeyring(1, map[int][]byte{1: key32(1)})
	oldCiphertext, oldVersion, _ := oldKeyring.Encrypt("rotate-me")

	newCiphertext, newVersion, err := kr.Rotate(oldCiphertext, oldVersion)
	if err != nil {
		t.Fatalf("Rotate: %v", err)
	}
	if newVersion != 2 {
		t.Fatalf("expected rotated ciphertext to carry current version 2, got %d", newVersion)
	}

	plaintext, err := kr.Decrypt(newCiphertext, newVersion)
	if err != nil {
		t.Fatalf("Decrypt after rotation: %v", err)
	}
	if plaintext != "rotate-me" {
		t.Fatalf("expected plaintext preserved across rotation, got %q", plaintext)
	}
}

func TestNewKeyring_RequiresCurrentVersionKey(t *testing.T) {
	_, err := NewKeyring(2, map[int][]byte{1: key32(1)})
	if err == nil {
		t.Fatal("expected an error when no key is provided for the current version")
	}
}

func TestNewKeyring_RequiresAtLeastOneKey(t *testing.T) {
	_, err := NewKeyring(1, map[int][]byte{})
	if err == nil {
		t.Fatal("expected an error when no keys are provided at all")
	}
}
