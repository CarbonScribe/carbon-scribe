package billing

import "fmt"

func InvoiceNumber(prefix string, seq int) string {
	return fmt.Sprintf("%s-%04d", prefix, seq)
}
