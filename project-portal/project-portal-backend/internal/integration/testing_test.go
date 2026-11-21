package integration

import "carbon-scribe/project-portal/project-portal-backend/pkg/encryption"

// testKeyring returns a throwaway Keyring for tests that construct a
// Service directly (#795) — NewService installs it as the package-level
// credentialsKeyring IntegrationConnection's GORM hooks use.
func testKeyring() *encryption.Keyring {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	kr, err := encryption.NewKeyring(1, map[int][]byte{1: key})
	if err != nil {
		panic(err)
	}
	return kr
}
