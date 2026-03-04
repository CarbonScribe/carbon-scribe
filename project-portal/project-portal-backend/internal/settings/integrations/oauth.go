package integrations

import "fmt"

func BuildOAuthStartURL(provider string) string {
	return fmt.Sprintf("/api/v1/settings/integrations/oauth/%s/start", provider)
}
