package billing

func DefaultUsageMetrics() map[string]interface{} {
	return map[string]interface{}{
		"credits_minted":  0,
		"storage_used_mb": 0,
	}
}
