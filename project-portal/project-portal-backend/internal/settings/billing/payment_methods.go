package billing

import "fmt"

func ValidatePaymentMethodType(kind string) error {
	switch kind {
	case "card", "bank_account", "crypto":
		return nil
	default:
		return fmt.Errorf("unsupported payment_method_type")
	}
}
