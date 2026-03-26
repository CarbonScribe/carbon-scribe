package payments

import "strings"

func IsStellarProvider(provider string) bool {
	p := strings.ToLower(strings.TrimSpace(provider))
	return p == "stellar" || p == "stellar_network"
}

func NormalizeAssetCode(currency string) string {
	v := strings.ToUpper(strings.TrimSpace(currency))
	if v == "" {
		return "USDC"
	}
	if v == "USD" {
		return "USDC"
	}
	return v
}
