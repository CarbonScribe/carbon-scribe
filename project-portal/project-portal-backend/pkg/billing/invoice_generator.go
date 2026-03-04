package billing

import "fmt"

type InvoiceGenerator interface {
	GeneratePDF(invoiceNumber string) (string, error)
}

type NoopInvoiceGenerator struct{}

func (NoopInvoiceGenerator) GeneratePDF(invoiceNumber string) (string, error) {
	return fmt.Sprintf("generated://invoices/%s.pdf", invoiceNumber), nil
}
