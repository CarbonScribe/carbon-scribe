package integrations

func ComputeHealth(isActive, isValid bool) string {
	if !isActive {
		return "disabled"
	}
	if !isValid {
		return "degraded"
	}
	return "healthy"
}
