package cryptography

import (
	"crypto/sha256"
	"fmt"
)

// HashChain provides a sequential hash chain for tamper-evident log storage.
type HashChain struct {
	lastHash string
}

// NewHashChain creates a new hash chain, optionally seeded with the last known hash.
func NewHashChain(seed string) *HashChain {
	return &HashChain{lastHash: seed}
}

// Append adds a new entry to the chain and returns the new hash.
func (hc *HashChain) Append(data string) string {
	input := fmt.Sprintf("%s|%s", hc.lastHash, data)
	hash := sha256.Sum256([]byte(input))
	hc.lastHash = fmt.Sprintf("%x", hash)
	return hc.lastHash
}

// Verify checks that a sequence of (data, hash) pairs forms a valid chain.
func (hc *HashChain) Verify(entries []ChainEntry) (bool, int) {
	prev := ""
	for i, entry := range entries {
		input := fmt.Sprintf("%s|%s", prev, entry.Data)
		hash := sha256.Sum256([]byte(input))
		expected := fmt.Sprintf("%x", hash)
		if expected != entry.Hash {
			return false, i
		}
		prev = entry.Hash
	}
	return true, -1
}

// LastHash returns the most recent hash in the chain.
func (hc *HashChain) LastHash() string {
	return hc.lastHash
}

// ChainEntry pairs raw data with its expected hash.
type ChainEntry struct {
	Data string
	Hash string
}
