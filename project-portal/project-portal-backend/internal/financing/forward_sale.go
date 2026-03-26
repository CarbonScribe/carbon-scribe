package financing

import "strings"

const (
	ForwardSaleStatusPending   = "pending"
	ForwardSaleStatusActive    = "active"
	ForwardSaleStatusCompleted = "completed"
	ForwardSaleStatusCancelled = "cancelled"
)

func normalizeCurrency(value string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(value))
	if trimmed == "" {
		return "USD"
	}
	return trimmed
}
