package health

import "sync"

// ComponentStatusProvider returns a live status snapshot for a named
// external component (e.g. "mqtt"). Registered providers are included in
// GetDetailedStatus's Components map alongside the built-in "database"
// check, so any package that owns a long-lived connection can surface its
// health on /health/status/detailed without this package needing to know
// about it directly.
type ComponentStatusProvider func() ComponentStatus

var (
	componentProvidersMu sync.RWMutex
	componentProviders   = map[string]ComponentStatusProvider{}
)

// RegisterComponentStatusProvider registers (or replaces) the status
// provider for a named component. Safe for concurrent use; typically
// called once at startup by whichever package owns that component's
// connection.
func RegisterComponentStatusProvider(name string, provider ComponentStatusProvider) {
	componentProvidersMu.Lock()
	defer componentProvidersMu.Unlock()
	componentProviders[name] = provider
}

// snapshotComponentProviders evaluates every registered provider and
// returns the current status of each.
func snapshotComponentProviders() map[string]ComponentStatus {
	componentProvidersMu.RLock()
	defer componentProvidersMu.RUnlock()

	out := make(map[string]ComponentStatus, len(componentProviders))
	for name, provider := range componentProviders {
		out[name] = provider()
	}
	return out
}
