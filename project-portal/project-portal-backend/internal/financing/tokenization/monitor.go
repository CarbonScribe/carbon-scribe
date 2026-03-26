package tokenization

import "strings"

type Monitor struct{}

func NewMonitor() *Monitor {
	return &Monitor{}
}

func (m *Monitor) ResolveFinalStatus(input string) string {
	switch strings.ToLower(strings.TrimSpace(input)) {
	case "confirmed", "success", "minted":
		return "minted"
	case "failed", "error":
		return "failed"
	default:
		return "pending"
	}
}
