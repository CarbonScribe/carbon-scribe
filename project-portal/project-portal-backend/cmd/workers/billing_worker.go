package workers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/notifications"
	"carbon-scribe/project-portal/project-portal-backend/internal/settings"
	"carbon-scribe/project-portal/project-portal-backend/internal/settings/billing"
	pkgbilling "carbon-scribe/project-portal/project-portal-backend/pkg/billing"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// BillingWorker handles recurring billing and dunning operations for settings subscriptions.
// It processes subscription renewals, generates invoices, attempts payments, and handles failures.
type BillingWorker struct {
	settingsService     settings.Service
	notificationService *notifications.Service
	stripeClient        pkgbilling.StripeClient
	invoiceGenerator    pkgbilling.InvoiceGenerator
	interval            time.Duration
	logger              *log.Logger
	mu                  sync.RWMutex
	// Configuration
	maxRetries           int
	retryDelayBase       time.Duration
	invoiceDaysBeforeDue int
}

// NewBillingWorker creates a new billing worker with the given dependencies.
// If interval is <= 0, defaults to 5 minutes for production.
// If logger is nil, uses the default logger.
func NewBillingWorker(
	settingsService settings.Service,
	notificationService *notifications.Service,
	stripeClient pkgbilling.StripeClient,
	invoiceGenerator pkgbilling.InvoiceGenerator,
	interval time.Duration,
	logger *log.Logger,
) *BillingWorker {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}
	if stripeClient == nil {
		stripeClient = pkgbilling.NoopStripeClient{}
	}
	if invoiceGenerator == nil {
		invoiceGenerator = pkgbilling.NoopInvoiceGenerator{}
	}

	return &BillingWorker{
		settingsService:      settingsService,
		notificationService:  notificationService,
		stripeClient:         stripeClient,
		invoiceGenerator:     invoiceGenerator,
		interval:             interval,
		logger:               logger,
		maxRetries:           3,
		retryDelayBase:       1 * time.Hour,
		invoiceDaysBeforeDue: 7,
	}
}

// Run begins the billing worker loop and blocks until context is cancelled.
// Returns error if context is nil.
func (w *BillingWorker) Run(ctx context.Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.logger.Printf("billing worker started with interval: %v\n", w.interval)

	for {
		select {
		case <-ctx.Done():
			w.logger.Println("billing worker: context cancelled, initiating graceful shutdown")
			return ctx.Err()

		case <-ticker.C:
			w.processBillingCycle(ctx)
		}
	}
}

// processBillingCycle orchestrates the main billing workflow:
// 1. Identify subscriptions due for billing
// 2. Generate invoices
// 3. Attempt payments
// 4. Handle failures and send notifications
func (w *BillingWorker) processBillingCycle(ctx context.Context) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	w.logger.Println("billing worker: triggered billing cycle")

	// For now, since we don't have direct access to list all subscriptions via settings.Service,
	// this is a placeholder that would be called by the main application.
	// In a real implementation, we would:
	// 1. Query all active subscriptions from the database
	// 2. Identify those with billing_cycle_due_date <= now
	// 3. Process each one

	w.logger.Println("billing worker: billing cycle completed")
}

// ProcessSubscriptionBilling handles the complete billing workflow for a single subscription.
// This method is called for subscriptions due for billing.
func (w *BillingWorker) ProcessSubscriptionBilling(ctx context.Context, userID uuid.UUID) error {
	// Simulate context check for graceful shutdown
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	w.logger.Printf("billing worker: processing subscription for user %s\n", userID)

	// Get current subscription
	billingSummary, err := w.settingsService.GetBilling(ctx, userID)
	if err != nil {
		w.logger.Printf("billing worker: failed to get billing summary for user %s: %v\n", userID, err)
		return err
	}

	if billingSummary == nil {
		w.logger.Printf("billing worker: no subscription found for user %s\n", userID)
		return nil
	}

	// Check if subscription is due for renewal
	if !w.isSubscriptionDue(billingSummary.Subscription.CurrentPeriodEnd) {
		w.logger.Printf("billing worker: subscription for user %s not due yet\n", userID)
		return nil
	}

	// Generate invoice
	invoice, err := w.generateInvoice(ctx, userID, billingSummary)
	if err != nil {
		w.logger.Printf("billing worker: failed to generate invoice for user %s: %v\n", userID, err)
		return err
	}

	// Attempt payment
	success, err := w.attemptPayment(ctx, userID, invoice, billingSummary.Subscription)
	if err != nil {
		w.logger.Printf("billing worker: payment attempt failed for user %s: %v\n", userID, err)
		// Continue to dunning logic even if payment fails
	}

	if success {
		// Mark invoice as paid
		invoice.Status = "paid"
		invoice.PaidAt = ptrTime(time.Now())
		invoice.TransactionID = fmt.Sprintf("stripe_charge_%s", uuid.New().String()[:12])
	} else {
		// Apply dunning logic
		if err := w.applyDunningLogic(ctx, userID, billingSummary.Subscription); err != nil {
			w.logger.Printf("billing worker: failed to apply dunning logic for user %s: %v\n", userID, err)
		}
	}

	// Send invoice notification
	if err := w.sendInvoiceNotification(ctx, userID, invoice); err != nil {
		w.logger.Printf("billing worker: failed to send invoice notification for user %s: %v\n", userID, err)
	}

	return nil
}

// isSubscriptionDue checks if a subscription billing period has ended and is due for renewal.
func (w *BillingWorker) isSubscriptionDue(currentPeriodEnd time.Time) bool {
	return time.Now().After(currentPeriodEnd)
}

// generateInvoice creates a new invoice for the subscription renewal.
func (w *BillingWorker) generateInvoice(
	ctx context.Context,
	userID uuid.UUID,
	billingSummary *settings.BillingSummary,
) (*settings.Invoice, error) {
	if billingSummary == nil {
		return nil, errors.New("billing summary is nil")
	}

	sub := billingSummary.Subscription

	// Generate invoice number
	invoiceNumber := billing.InvoiceNumber("INV", int(time.Now().Unix()%9999)+1)

	// Calculate amounts based on plan
	amount, taxAmount := w.calculatePlanAmount(sub.PlanID)

	totalAmount := amount + taxAmount

	// Create invoice object
	invoice := &settings.Invoice{
		ID:                 uuid.New(),
		SubscriptionID:     &sub.ID,
		UserID:             userID,
		InvoiceNumber:      invoiceNumber,
		Amount:             amount,
		Currency:           "USD",
		TaxAmount:          taxAmount,
		TotalAmount:        totalAmount,
		BillingPeriodStart: sub.CurrentPeriodEnd.AddDate(0, 0, -30), // Assuming monthly billing
		BillingPeriodEnd:   sub.CurrentPeriodEnd,
		Status:             "draft",
		DueDate:            ptrTime(sub.CurrentPeriodEnd.AddDate(0, 0, 30)),
		PaymentMethod:      sub.PaymentMethodType,
		LineItems: datatypes.JSON(
			[]byte(
				fmt.Sprintf(
					`[{"description":"Subscription - %s","amount":%.2f,"quantity":1}]`,
					sub.PlanName,
					amount,
				),
			),
		),
	}

	// Generate PDF
	pdfURL, err := w.invoiceGenerator.GeneratePDF(invoiceNumber)
	if err != nil {
		w.logger.Printf("billing worker: failed to generate PDF for invoice %s: %v\n", invoiceNumber, err)
		// Don't fail the entire process if PDF generation fails
	} else {
		invoice.PDFURL = pdfURL
		invoice.PDFGeneratedAt = ptrTime(time.Now())
	}

	return invoice, nil
}

// attemptPayment tries to charge the payment method on file.
// Returns true if payment succeeded, false otherwise.
func (w *BillingWorker) attemptPayment(
	ctx context.Context,
	userID uuid.UUID,
	invoice *settings.Invoice,
	sub *settings.Subscription,
) (bool, error) {
	if sub.PaymentMethodID == "" {
		w.logger.Printf("billing worker: no payment method on file for user %s\n", userID)
		return false, errors.New("no payment method on file")
	}

	// Simulate payment attempt with Stripe
	// In a real implementation, this would call the Stripe API
	w.logger.Printf("billing worker: attempting payment for user %s, amount: %.2f\n", userID, invoice.TotalAmount)

	// Mock: 90% success rate for demonstration
	if time.Now().UnixNano()%10 >= 1 {
		w.logger.Printf("billing worker: payment successful for user %s\n", userID)
		return true, nil
	}

	w.logger.Printf("billing worker: payment failed for user %s (insufficient funds, card declined, etc.)\n", userID)
	return false, errors.New("payment declined")
}

// applyDunningLogic transitions the subscription status for failed payment.
// This implements retry logic: active -> past_due -> unpaid.
func (w *BillingWorker) applyDunningLogic(
	ctx context.Context,
	userID uuid.UUID,
	sub *settings.Subscription,
) error {
	// Transition to next dunning state
	nextStatus := billing.NextDunningStatus(sub.Status, false)
	sub.Status = nextStatus

	w.logger.Printf("billing worker: subscription for user %s transitioned to %s due to failed payment\n", userID, nextStatus)

	// In a real implementation, we would save the updated subscription
	// For now, this is logged for demonstration

	return nil
}

// sendInvoiceNotification sends invoice details to the user via email.
func (w *BillingWorker) sendInvoiceNotification(
	ctx context.Context,
	userID uuid.UUID,
	invoice *settings.Invoice,
) error {
	if w.notificationService == nil {
		w.logger.Printf("billing worker: notification service not available, skipping invoice notification for user %s\n", userID)
		return nil
	}

	// Send via notification service
	// In a real implementation, this would construct a proper notification request
	// with email template, invoice PDF attachment, etc.
	w.logger.Printf("billing worker: sending invoice notification for user %s, invoice %s\n", userID, invoice.InvoiceNumber)

	return nil
}

// calculatePlanAmount returns the amount and tax for the given plan.
func (w *BillingWorker) calculatePlanAmount(planID string) (amount, taxAmount float64) {
	// Plan pricing (in USD) — these are mock prices
	planPrices := map[string]float64{
		"free":       0.00,
		"basic":      29.99,
		"pro":        99.99,
		"enterprise": 299.99,
	}

	baseAmount, ok := planPrices[planID]
	if !ok {
		baseAmount = 29.99 // Default to basic
	}

	tax := baseAmount * 0.10 // Assume 10% tax
	return baseAmount, tax
}

// ptrTime is a helper to return a pointer to a time.Time.
func ptrTime(t time.Time) *time.Time {
	return &t
}
