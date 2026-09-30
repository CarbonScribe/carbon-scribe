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

// ResolveTrustlineAssetCode returns the normalized asset code a buyer's
// trustline should be established for, given the payment provider and
// currency of an intended transfer. ok is false when provider is not a
// Stellar payment provider, in which case no trustline is required.
func ResolveTrustlineAssetCode(provider, currency string) (assetCode string, ok bool) {
	if !IsStellarProvider(provider) {
		return "", false
	}
	return NormalizeAssetCode(currency), true
}
