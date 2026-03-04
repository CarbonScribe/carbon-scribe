package profile

import "strings"

func NormalizeDisplayName(fullName, displayName string) string {
	if strings.TrimSpace(displayName) != "" {
		return strings.TrimSpace(displayName)
	}
	return strings.TrimSpace(fullName)
}
