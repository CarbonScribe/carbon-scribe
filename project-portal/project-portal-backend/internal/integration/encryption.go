package integration

import (
	"encoding/hex"
	"fmt"
	"strings"

	"carbon-scribe/project-portal/project-portal-backend/pkg/encryption"
)

// devDefaultEncryptionKey is the deterministic local fallback used when no
// real key is configured — kept identical to internal/settings' own
// decodeEncryptionKey fallback, since both packages are meant to share the
// same SETTINGS_ENCRYPTION_KEY_HEX value (#795). It is never reachable in
// production: Config.Validate already refuses to start without a real key.
const devDefaultEncryptionKey = "settings-dev-encryption-key-32!!"

// credentialsKeyring is the active Keyring IntegrationConnection's
// BeforeSave/AfterFind hooks use to encrypt/decrypt Credentials (#795). GORM
// model hooks have no constructor-injection mechanism of their own, so the
// keyring is installed once, package-level, via SetCredentialsKeyring —
// called from NewService before any connection is created, read or updated.
var credentialsKeyring *encryption.Keyring

// SetCredentialsKeyring installs the keyring used by IntegrationConnection's
// GORM hooks. Exported so tests can install a throwaway keyring without
// going through NewService.
func SetCredentialsKeyring(k *encryption.Keyring) {
	credentialsKeyring = k
}

// BuildCredentialsKeyring constructs the Keyring from hex-encoded keys —
// currentKeyHex is SETTINGS_ENCRYPTION_KEY_HEX (shared with
// internal/settings' own encrypted fields, rather than introducing a second
// encryption key to manage), falling back to the same deterministic
// dev-only key internal/settings uses when unset.
func BuildCredentialsKeyring(currentVersion int, currentKeyHex string, previousKeysHex map[int]string) (*encryption.Keyring, error) {
	keys := map[int][]byte{}

	currentKey, err := decodeKeyHexOrDevDefault(currentKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid current encryption key: %w", err)
	}
	keys[currentVersion] = currentKey

	for version, keyHex := range previousKeysHex {
		key, err := hex.DecodeString(strings.TrimSpace(keyHex))
		if err != nil {
			return nil, fmt.Errorf("invalid encryption key for version %d: %w", version, err)
		}
		keys[version] = key
	}

	return encryption.NewKeyring(currentVersion, keys)
}

func decodeKeyHexOrDevDefault(hexKey string) ([]byte, error) {
	trimmed := strings.TrimSpace(hexKey)
	if trimmed == "" {
		return []byte(devDefaultEncryptionKey), nil
	}
	return hex.DecodeString(trimmed)
}
