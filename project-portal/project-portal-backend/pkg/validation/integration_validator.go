package validation

import (
	"fmt"
	"strings"
)

var allowedIntegrationTypes = map[string]struct{}{
	"stripe":          {},
	"stellar_wallet":  {},
	"satellite_api":   {},
	"weather_service": {},
	"webhook":         {},
}

func ValidateIntegrationType(t string) error {
	if strings.TrimSpace(t) == "" {
		return fmt.Errorf("integration_type is required")
	}
	if _, ok := allowedIntegrationTypes[t]; !ok {
		return fmt.Errorf("unsupported integration_type")
	}
	return nil
}

func ValidateIntegrationName(name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("integration_name is required")
	}
	if len(name) > 255 {
		return fmt.Errorf("integration_name too long")
	}
	return nil
}
