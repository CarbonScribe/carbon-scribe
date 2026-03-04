package api

import "fmt"

var allowedScopes = map[string]struct{}{
	"settings:read":         {},
	"settings:write":        {},
	"settings:api_keys":     {},
	"settings:integrations": {},
	"settings:billing":      {},
}

func ValidateScopes(scopes []string) error {
	for _, s := range scopes {
		if _, ok := allowedScopes[s]; !ok {
			return fmt.Errorf("unsupported scope: %s", s)
		}
	}
	return nil
}
