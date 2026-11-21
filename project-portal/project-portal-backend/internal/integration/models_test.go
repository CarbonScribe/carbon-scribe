package integration

import (
	"strings"
	"testing"

	"carbon-scribe/project-portal/project-portal-backend/pkg/encryption"
)

func TestIntegrationConnection_CredentialsEncryptedAtRest(t *testing.T) {
	SetCredentialsKeyring(testKeyring())
	defer SetCredentialsKeyring(nil)

	conn := &IntegrationConnection{
		Credentials: map[string]any{"api_key": "sk_live_super_secret"},
	}

	if err := conn.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave: %v", err)
	}

	if conn.CredentialsCiphertext == "" {
		t.Fatal("expected CredentialsCiphertext to be populated")
	}
	if conn.CredentialsCiphertext == "sk_live_super_secret" {
		t.Fatal("stored ciphertext must not equal the plaintext credential value")
	}
	if strings.Contains(conn.CredentialsCiphertext, "sk_live_super_secret") {
		t.Fatal("stored ciphertext must not contain the plaintext credential value")
	}
	if conn.CredentialsKeyVersion != 1 {
		t.Fatalf("expected key version 1, got %d", conn.CredentialsKeyVersion)
	}
}

func TestIntegrationConnection_RoundTripEncryptDecrypt(t *testing.T) {
	SetCredentialsKeyring(testKeyring())
	defer SetCredentialsKeyring(nil)

	original := &IntegrationConnection{
		Credentials: map[string]any{"api_key": "sk_live_super_secret", "region": "us-east-1"},
	}
	if err := original.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave: %v", err)
	}

	// Simulate what a GORM First/Find would populate from the row before
	// calling AfterFind.
	loaded := &IntegrationConnection{
		CredentialsCiphertext: original.CredentialsCiphertext,
		CredentialsKeyVersion: original.CredentialsKeyVersion,
	}
	if err := loaded.AfterFind(nil); err != nil {
		t.Fatalf("AfterFind: %v", err)
	}

	if loaded.Credentials["api_key"] != "sk_live_super_secret" {
		t.Fatalf("expected decrypted api_key, got %v", loaded.Credentials["api_key"])
	}
	if loaded.Credentials["region"] != "us-east-1" {
		t.Fatalf("expected decrypted region, got %v", loaded.Credentials["region"])
	}
}

func TestIntegrationConnection_AfterFindFailsWithWrongKey(t *testing.T) {
	SetCredentialsKeyring(testKeyring())
	conn := &IntegrationConnection{Credentials: map[string]any{"api_key": "secret"}}
	if err := conn.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave: %v", err)
	}

	// Swap in a keyring with a different key for the same version — the
	// stored ciphertext can no longer be decrypted.
	wrongKey := make([]byte, 32)
	for i := range wrongKey {
		wrongKey[i] = 0xFF
	}
	wrongKeyring, err := encryption.NewKeyring(1, map[int][]byte{1: wrongKey})
	if err != nil {
		t.Fatalf("NewKeyring: %v", err)
	}
	SetCredentialsKeyring(wrongKeyring)
	defer SetCredentialsKeyring(nil)

	loaded := &IntegrationConnection{
		CredentialsCiphertext: conn.CredentialsCiphertext,
		CredentialsKeyVersion: conn.CredentialsKeyVersion,
	}
	if err := loaded.AfterFind(nil); err == nil {
		t.Fatal("expected AfterFind to fail when decrypted with the wrong key")
	}
}

func TestIntegrationConnection_NoCredentialsSetSkipsEncryption(t *testing.T) {
	SetCredentialsKeyring(testKeyring())
	defer SetCredentialsKeyring(nil)

	conn := &IntegrationConnection{}
	if err := conn.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave: %v", err)
	}
	if conn.CredentialsCiphertext != "" {
		t.Fatal("expected no ciphertext when Credentials was never set")
	}
}

func TestIntegrationConnection_BeforeSaveFailsWithoutKeyring(t *testing.T) {
	SetCredentialsKeyring(nil)

	conn := &IntegrationConnection{Credentials: map[string]any{"api_key": "secret"}}
	if err := conn.BeforeSave(nil); err == nil {
		t.Fatal("expected BeforeSave to fail when no keyring is configured")
	}
}

func TestKeyring_RotationReencryptsConnectionCredentials(t *testing.T) {
	oldKey := make([]byte, 32)
	for i := range oldKey {
		oldKey[i] = 1
	}
	newKey := make([]byte, 32)
	for i := range newKey {
		newKey[i] = 2
	}

	oldKeyring, _ := encryption.NewKeyring(1, map[int][]byte{1: oldKey})
	SetCredentialsKeyring(oldKeyring)
	conn := &IntegrationConnection{Credentials: map[string]any{"api_key": "secret"}}
	if err := conn.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave: %v", err)
	}
	oldCiphertext, oldVersion := conn.CredentialsCiphertext, conn.CredentialsKeyVersion

	// Rotate: the current keyring now knows both the old and new key.
	rotatingKeyring, err := encryption.NewKeyring(2, map[int][]byte{1: oldKey, 2: newKey})
	if err != nil {
		t.Fatalf("NewKeyring: %v", err)
	}
	SetCredentialsKeyring(rotatingKeyring)
	defer SetCredentialsKeyring(nil)

	newCiphertext, newVersion, err := rotatingKeyring.Rotate(oldCiphertext, oldVersion)
	if err != nil {
		t.Fatalf("Rotate: %v", err)
	}
	if newVersion != 2 {
		t.Fatalf("expected rotated version 2, got %d", newVersion)
	}

	rotated := &IntegrationConnection{
		CredentialsCiphertext: newCiphertext,
		CredentialsKeyVersion: newVersion,
	}
	if err := rotated.AfterFind(nil); err != nil {
		t.Fatalf("AfterFind after rotation: %v", err)
	}
	if rotated.Credentials["api_key"] != "secret" {
		t.Fatalf("expected credentials preserved across rotation, got %v", rotated.Credentials["api_key"])
	}
}
