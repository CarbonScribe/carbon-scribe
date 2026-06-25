# Billing Worker Integration Guide

This guide explains how to integrate the billing worker into the project portal backend's main API server.

## Step 1: Update `cmd/api/main.go`

### Add Worker Initialization (after line 200, in service initialization section)

```go
// Import at the top of the file
import (
    // ... other imports ...
    "carbon-scribe/project-portal/project-portal-backend/cmd/workers"
    pkgbilling "carbon-scribe/project-portal/project-portal-backend/pkg/billing"
)

// After settingsService initialization (around line 250):

// Initialize billing worker dependencies
billingStripeClient := pkgbilling.NoopStripeClient{} // TODO: Replace with real Stripe client
billingInvoiceGen := pkgbilling.NoopInvoiceGenerator{} // TODO: Replace with real PDF generator

// Initialize billing worker with 5-minute interval
billingWorker := workers.NewBillingWorker(
    settingsService,
    notificationsService,
    billingStripeClient,
    billingInvoiceGen,
    5*time.Minute,
    log.New(os.Stdout, "[billing-worker] ", log.LstdFlags),
)
```

### Start Worker in Goroutine (before server.ListenAndServe())

```go
// Start billing worker in background
billingCtx, billingCancel := context.WithCancel(context.Background())
go func() {
    fmt.Println("🧾 Billing worker started")
    if err := billingWorker.Run(billingCtx); err != nil {
        if err != context.Canceled {
            fmt.Printf("❌ Billing worker error: %v\n", err)
        }
    }
    fmt.Println("🧾 Billing worker stopped")
}()

// Store billingCancel for graceful shutdown
```

### Update Graceful Shutdown (in quit handler)

```go
// Channel to listen for interrupt signal
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

// ... server startup code ...

// Wait for interrupt signal
<-quit
fmt.Println("\n🛑 Shutdown signal received...")

// Cancel billing worker first
billingCancel()
fmt.Println("🧾 Billing worker shutdown initiated")

// Then shutdown HTTP server
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

if err := server.Shutdown(ctx); err != nil {
    log.Fatalf("❌ Server forced to shutdown: %v", err)
}

fmt.Println("✅ Server exited gracefully")
```

## Step 2: Implement Real Payment Gateway Integration

### Create `pkg/billing/stripe_implementation.go`

```go
package billing

import (
    "context"
    "fmt"
    
    "github.com/stripe/stripe-go/v80"
    "github.com/stripe/stripe-go/v80/paymentmethod"
)

type StripePaymentClient struct {
    apiKey string
}

func NewStripePaymentClient(apiKey string) *StripePaymentClient {
    stripe.Key = apiKey
    return &StripePaymentClient{apiKey: apiKey}
}

func (c *StripePaymentClient) CreatePaymentMethod(ctx context.Context, token string) (string, error) {
    pm, err := paymentmethod.New(&stripe.PaymentMethodParams{
        Type: stripe.String(string(stripe.PaymentMethodTypeCard)),
        Card: &stripe.PaymentMethodCardParams{
            Token: stripe.String(token),
        },
    })
    if err != nil {
        return "", fmt.Errorf("failed to create payment method: %w", err)
    }
    return pm.ID, nil
}

// TODO: Add ChargePaymentMethod for actual payment processing
// TODO: Add ListPaymentMethods for retrieving saved methods
// TODO: Add DeletePaymentMethod for cleanup
```

### Update `cmd/api/main.go` to use real Stripe client

```go
billingStripeClient := billing.NewStripePaymentClient(cfg.Stripe.APIKey)
```

## Step 3: Implement Invoice PDF Generation

### Create `pkg/billing/pdf_generator.go`

```go
package billing

import (
    "fmt"
    
    "github.com/jung-kurt/gofpdf"
)

type PDFInvoiceGenerator struct {
    storageBucket string // S3 bucket for storing PDFs
}

func NewPDFInvoiceGenerator(bucket string) *PDFInvoiceGenerator {
    return &PDFInvoiceGenerator{storageBucket: bucket}
}

func (g *PDFInvoiceGenerator) GeneratePDF(invoiceNumber string) (string, error) {
    pdf := gofpdf.New("P", "mm", "A4", "")
    pdf.AddPage()
    pdf.SetFont("Arial", "B", 16)
    pdf.Cell(0, 10, "INVOICE")
    
    pdf.SetFont("Arial", "", 12)
    pdf.Ln(10)
    pdf.Cell(0, 10, fmt.Sprintf("Invoice #: %s", invoiceNumber))
    
    // TODO: Add customer details, line items, totals, terms
    // TODO: Save to S3 and return URL
    
    return fmt.Sprintf("generated://invoices/%s.pdf", invoiceNumber), nil
}
```

## Step 4: Configure Environment Variables

Add to `.env` file:

```env
# Stripe Configuration
STRIPE_API_KEY=sk_live_xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...

# Billing Worker
BILLING_WORKER_INTERVAL=300s  # 5 minutes in seconds
BILLING_WORKER_MAX_RETRIES=3
BILLING_WORKER_RETRY_DELAY=3600s  # 1 hour in seconds

# Invoice Generation
INVOICE_PDF_BUCKET=carbon-scribe-invoices
```

## Step 5: Add Configuration to `internal/config/config.go`

```go
type BillingConfig struct {
    WorkerInterval   time.Duration
    MaxRetries       int
    RetryDelayBase   time.Duration
}

type StripeConfig struct {
    APIKey        string
    WebhookSecret string
}

// In Config struct:
Billing BillingConfig
Stripe  StripeConfig

// In Load() function:
cfg.Billing.WorkerInterval = parseDuration(os.Getenv("BILLING_WORKER_INTERVAL"), 5*time.Minute)
cfg.Billing.MaxRetries = parseIntOrDefault(os.Getenv("BILLING_WORKER_MAX_RETRIES"), 3)
cfg.Stripe.APIKey = os.Getenv("STRIPE_API_KEY")
cfg.Stripe.WebhookSecret = os.Getenv("STRIPE_WEBHOOK_SECRET")
```

## Step 6: Database Schema Updates (if needed)

If not already present, add indexes to `invoices` table:

```sql
-- For faster lookups during billing cycles
CREATE INDEX idx_subscriptions_user_period ON subscriptions(user_id, current_period_end) WHERE status = 'active';
CREATE INDEX idx_invoices_user_status ON invoices(user_id, status) WHERE status != 'paid';
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status = 'draft';
```

## Step 7: Add Stripe Webhook Handler (Optional)

For handling payment webhooks:

```go
// In cmd/api/main.go, add webhook route:

v1.POST("/webhooks/stripe", func(c *gin.Context) {
    body, err := io.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
        return
    }

    event, err := webhook.ConstructEvent(body, c.GetHeader("Stripe-Signature"), cfg.Stripe.WebhookSecret)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
        return
    }

    switch event.Type {
    case "payment_intent.succeeded":
        // Handle successful payment
        var pi stripe.PaymentIntent
        err := json.Unmarshal(event.Data.Raw, &pi)
        // TODO: Update invoice status and subscription
    case "charge.failed":
        // Handle failed charge
        // TODO: Trigger dunning logic
    }

    c.JSON(http.StatusOK, gin.H{"status": "received"})
})
```

## Step 8: Testing Integration

### Manual Testing

```bash
# Start the server
cd project-portal/project-portal-backend
go run cmd/api/main.go

# Watch for billing worker logs
# Should see: "[billing-worker] billing worker started with interval: 5m0s"
# Every 5 minutes: "[billing-worker] billing worker: triggered billing cycle"
```

### Test Subscription Billing

```bash
# Create a test subscription with past due date
curl -X POST http://localhost:8000/api/v1/settings/billing \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan_id": "pro"}'

# Wait 5 minutes for billing cycle to trigger
# Check logs and database for invoice generation
```

## Step 9: Monitoring & Logging

### Add Structured Logging

Replace `log.Println()` with structured logging:

```go
// Using logrus or zap
logger.WithFields(logrus.Fields{
    "user_id": userID,
    "action": "payment_attempt",
    "amount": amount,
}).Info("Processing payment")
```

### Add Metrics

```go
// Using Prometheus
billingCycleCounter := prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "billing_cycles_total",
        Help: "Total number of billing cycles processed",
    },
    []string{"status"},
)

paymentCounter := prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "payments_total",
        Help: "Total payments attempted",
    },
    []string{"status"},
)
```

## Step 10: Documentation Updates

Update project README:

```markdown
### Background Workers

The project runs several background workers for automated operations:

#### Billing Worker
- **Interval**: 5 minutes (configurable)
- **Function**: Processes recurring subscription billing
- **Features**:
  - Automatic invoice generation
  - Payment processing via Stripe
  - Dunning logic for failed payments
  - Invoice delivery notifications
- **Configuration**: `BILLING_WORKER_*` environment variables
- **Status**: Active in production
```

## Troubleshooting

### Billing Worker Not Starting
- Check logs for error messages
- Verify all dependencies initialized (settingsService, notificationsService)
- Ensure database connection is working

### Invoices Not Generated
- Check if subscriptions exist with `current_period_end` in the past
- Verify `settingsService.GetBilling()` returns data
- Check PDF generator configuration

### Payments Not Processing
- Verify Stripe API key is set correctly
- Check Stripe API response in logs
- Test with mock Stripe client first

### Worker Blocking Server Shutdown
- Ensure context cancellation is wired correctly
- Set appropriate shutdown timeout (30s should be sufficient)
- Check for goroutine leaks in logs

## Production Deployment Checklist

- [ ] Real Stripe API key configured
- [ ] PDF generation implemented and tested
- [ ] Database indexes created
- [ ] Environment variables set in deployment
- [ ] Worker logs configured
- [ ] Monitoring and alerting set up
- [ ] Backup/recovery plan for payment failures
- [ ] Load testing with expected user base
- [ ] Staging environment tested thoroughly
- [ ] Documentation updated for ops team
