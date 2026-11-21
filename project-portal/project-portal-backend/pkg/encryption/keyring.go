package encryption

import "fmt"

// Keyring holds the active encryption key plus any previous key versions
// still needed to decrypt ciphertext written before a key rotation (#795).
// Encrypt always uses CurrentVersion's key; Decrypt looks up whichever
// version the caller recorded alongside the ciphertext, so old rows stay
// readable after the current key changes.
type Keyring struct {
	currentVersion int
	vaults         map[int]*Vault
}

// NewKeyring builds a Keyring from one key per version. currentVersion must
// have a corresponding entry in keysByVersion.
func NewKeyring(currentVersion int, keysByVersion map[int][]byte) (*Keyring, error) {
	if len(keysByVersion) == 0 {
		return nil, fmt.Errorf("at least one key is required")
	}
	vaults := make(map[int]*Vault, len(keysByVersion))
	for version, key := range keysByVersion {
		vault, err := NewVault(key)
		if err != nil {
			return nil, fmt.Errorf("key version %d: %w", version, err)
		}
		vaults[version] = vault
	}
	if _, ok := vaults[currentVersion]; !ok {
		return nil, fmt.Errorf("no key provided for current version %d", currentVersion)
	}
	return &Keyring{currentVersion: currentVersion, vaults: vaults}, nil
}

// CurrentVersion returns the key version Encrypt will use.
func (k *Keyring) CurrentVersion() int {
	return k.currentVersion
}

// Encrypt encrypts plaintext with the current key version, returning the
// ciphertext and the version it must be decrypted with later.
func (k *Keyring) Encrypt(plaintext string) (ciphertext string, version int, err error) {
	ciphertext, err = k.vaults[k.currentVersion].EncryptString(plaintext)
	return ciphertext, k.currentVersion, err
}

// Decrypt decrypts ciphertext using the key recorded for it at version. It
// fails if that version's key isn't loaded into this Keyring (e.g. a stale
// previous key that was never configured, or the wrong key entirely).
func (k *Keyring) Decrypt(ciphertext string, version int) (string, error) {
	vault, ok := k.vaults[version]
	if !ok {
		return "", fmt.Errorf("no key available for version %d", version)
	}
	return vault.DecryptString(ciphertext)
}

// Rotate decrypts ciphertext with oldVersion's key and re-encrypts it with
// the current version's key. RotationManager (key_rotation.go) decides WHEN
// a row should be rotated; this is the HOW.
func (k *Keyring) Rotate(ciphertext string, oldVersion int) (newCiphertext string, newVersion int, err error) {
	plaintext, err := k.Decrypt(ciphertext, oldVersion)
	if err != nil {
		return "", 0, fmt.Errorf("decrypt for rotation: %w", err)
	}
	return k.Encrypt(plaintext)
}
