package payments

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// PaymentProcessorRegistry manages payment processors
type PaymentProcessorRegistry struct {
	processors map[string]PaymentProcessor
	config     *ProcessorConfig
}

// ProcessorConfig holds configuration for payment processors
type ProcessorConfig struct {
	Stripe      StripeConfig      `json:"stripe"`
	PayPal      PayPalConfig      `json:"paypal"`
	M_Pesa      M_PesaConfig      `json:"m_pesa"`
	Stellar     StellarConfig     `json:"stellar"`
	BankTransfer BankTransferConfig `json:"bank_transfer"`
}

// StripeConfig holds Stripe configuration
type StripeConfig struct {
	SecretKey      string `json:"secret_key"`
	PublishableKey string `json:"publishable_key"`
	WebhookSecret  string `json:"webhook_secret"`
	Environment    string `json:"environment"` // sandbox, live
}

// PayPalConfig holds PayPal configuration
type PayPalConfig struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	Environment  string `json:"environment"` // sandbox, live
	WebhookURL    string `json:"webhook_url"`
}

// M_PesaConfig holds M-Pesa configuration
type M_PesaConfig struct {
	ConsumerKey    string `json:"consumer_key"`
	ConsumerSecret string `json:"consumer_secret"`
	Shortcode      string `json:"shortcode"`
	Passkey        string `json:"passkey"`
	Environment    string `json:"environment"` // sandbox, live
}

// StellarConfig holds Stellar configuration
type StellarConfig struct {
	HorizonURL    string `json:"horizon_url"`
	SorobanURL    string `json:"soroban_url"`
	NetworkPassphrase string `json:"network_passphrase"`
	IssuerSecret  string `json:"issuer_secret"`
}

// BankTransferConfig holds bank transfer configuration
type BankTransferConfig struct {
	BankAPIURL    string `json:"bank_api_url"`
	APIKey        string `json:"api_key"`
	BankCode      string `json:"bank_code"`
}

// StripeProcessor implements Stripe payment processing
type StripeProcessor struct {
	client *http.Client
	config StripeConfig
}

// PayPalProcessor implements PayPal payment processing
type PayPalProcessor struct {
	client *http.Client
	config PayPalConfig
	token  string
}

// M_PesaProcessor implements M-Pesa payment processing
type M_PesaProcessor struct {
	client *http.Client
	config M_PesaConfig
	token  string
}

// StellarPaymentProcessor implements Stellar payment processing
type StellarPaymentProcessor struct {
	client *http.Client
	config StellarConfig
}

// BankTransferProcessor implements bank transfer processing
type BankTransferProcessor struct {
	client *http.Client
	config BankTransferConfig
}

// PaymentRequest represents a payment request
type PaymentRequest struct {
	Amount        float64                   `json:"amount"`
	Currency      string                    `json:"currency"`
	Recipient     PaymentRecipient          `json:"recipient"`
	PaymentMethod string                    `json:"payment_method"`
	ReferenceID   string                    `json:"reference_id"`
	Description   string                    `json:"description"`
	Metadata      map[string]interface{}    `json:"metadata"`
	WebhookURL    string                    `json:"webhook_url"`
	ReturnURL     string                    `json:"return_url"`
}

// PaymentResponse represents a payment response
type PaymentResponse struct {
	TransactionID     string                    `json:"transaction_id"`
	Status            string                    `json:"status"`
	Amount            float64                   `json:"amount"`
	Currency          string                    `json:"currency"`
	Processor         string                    `json:"processor"`
	EstimatedArrival  time.Time                 `json:"estimated_arrival"`
	Fees              float64                   `json:"fees"`
	AuthorizationURL  string                    `json:"authorization_url,omitempty"`
	QRCode            string                    `json:"qr_code,omitempty"`
	Metadata          map[string]interface{}    `json:"metadata"`
}

// PaymentStatusResponse represents payment status response
type PaymentStatusResponse struct {
	TransactionID   string                   `json:"transaction_id"`
	Status          string                   `json:"status"`
	Amount          float64                  `json:"amount"`
	Currency        string                   `json:"currency"`
	ProcessedAt     *time.Time               `json:"processed_at,omitempty"`
	FailureReason   *string                  `json:"failure_reason,omitempty"`
	ProviderStatus  map[string]interface{}   `json:"provider_status"`
	ReceiptURL      string                   `json:"receipt_url,omitempty"`
}

// RefundResponse represents refund response
type RefundResponse struct {
	RefundID      string    `json:"refund_id"`
	TransactionID string    `json:"transaction_id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	ProcessedAt   time.Time `json:"processed_at"`
	Reason        string    `json:"reason,omitempty"`
}

// NewPaymentProcessorRegistry creates a new payment processor registry
func NewPaymentProcessorRegistry(config *ProcessorConfig) *PaymentProcessorRegistry {
	registry := &PaymentProcessorRegistry{
		processors: make(map[string]PaymentProcessor),
		config:     config,
	}
	
	// Register processors
	registry.processors["stripe"] = NewStripeProcessorImpl(config.Stripe)
	registry.processors["paypal"] = NewPayPalProcessorImpl(config.PayPal)
	registry.processors["m_pesa"] = NewM_PesaProcessorImpl(config.M_Pesa)
	registry.processors["stellar"] = NewStellarPaymentProcessorImpl(config.Stellar)
	registry.processors["bank_transfer"] = NewBankTransferProcessorImpl(config.BankTransfer)
	
	return registry
}

// GetProcessor gets a payment processor by name
func (ppr *PaymentProcessorRegistry) GetProcessor(name string) (PaymentProcessor, error) {
	processor, exists := ppr.processors[name]
	if !exists {
		return nil, fmt.Errorf("payment processor %s not found", name)
	}
	return processor, nil
}

// ListProcessors lists all available processors
func (ppr *PaymentProcessorRegistry) ListProcessors() []string {
	processors := make([]string, 0, len(ppr.processors))
	for name := range ppr.processors {
		processors = append(processors, name)
	}
	return processors
}

// NewStripeProcessorImpl creates a new Stripe processor
func NewStripeProcessorImpl(config StripeConfig) *StripeProcessor {
	return &StripeProcessor{
		client: &http.Client{Timeout: 30 * time.Second},
		config: config,
	}
}

func (sp *StripeProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Create payment intent
	paymentIntent := map[string]interface{}{
		"amount":              int64(req.Amount * 100), // Stripe uses cents
		"currency":            req.Currency,
		"payment_method_types": []string{"card"},
		"metadata": map[string]string{
			"reference_id": req.ReferenceID,
			"description": req.Description,
		},
		"confirmation_method": "manual",
		"confirm":            "false",
	}
	
	// In a real implementation, this would make an actual API call to Stripe
	// For now, return a mock response
	
	transactionID := fmt.Sprintf("pi_%d_%s", time.Now().Unix(), uuid.New().String()[:8])
	
	return &PaymentResponse{
		TransactionID:    transactionID,
		Status:          "requires_payment_method",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "stripe",
		EstimatedArrival: time.Now().Add(2 * 24 * time.Hour),
		Fees:           req.Amount * 0.029 + 0.30, // 2.9% + $0.30
		AuthorizationURL: fmt.Sprintf("https://checkout.stripe.com/pay/%s", transactionID),
		Metadata: map[string]interface{}{
			"client_secret": fmt.Sprintf("pi_%s_secret_%s", transactionID, uuid.New().String()[:8]),
		},
	}, nil
}

func (sp *StripeProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	// In a real implementation, this would query Stripe API
	// For now, return a mock response
	
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "succeeded",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{
			"charges": map[string]interface{}{
				"data": []map[string]interface{}{
					{
						"id":     fmt.Sprintf("ch_%d", time.Now().Unix()),
						"status": "succeeded",
						"amount": 10000, // in cents
					},
				},
			},
		},
		ReceiptURL: fmt.Sprintf("https://dashboard.stripe.com/receipts/%s", transactionID),
	}, nil
}

func (sp *StripeProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	// In a real implementation, this would create a refund via Stripe API
	refundID := fmt.Sprintf("re_%d_%s", time.Now().Unix(), uuid.New().String()[:8])
	
	return &RefundResponse{
		RefundID:      refundID,
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "succeeded",
		ProcessedAt:   time.Now(),
		Reason:        "requested_by_customer",
	}, nil
}

func (sp *StripeProcessor) GetSupportedCurrencies() []string {
	return []string{"USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN"}
}

func (sp *StripeProcessor) GetName() string {
	return "Stripe"
}

// NewPayPalProcessorImpl creates a new PayPal processor
func NewPayPalProcessorImpl(config PayPalConfig) *PayPalProcessor {
	return &PayPalProcessor{
		client: &http.Client{Timeout: 30 * time.Second},
		config: config,
	}
}

func (pp *PayPalProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Create PayPal order
	order := map[string]interface{}{
		"intent": "CAPTURE",
		"purchase_units": []map[string]interface{}{
			{
				"amount": map[string]interface{}{
					"currency_code": req.Currency,
					"value":         fmt.Sprintf("%.2f", req.Amount),
				},
				"description": req.Description,
				"reference_id": req.ReferenceID,
			},
		},
	}
	
	// In a real implementation, this would make an actual API call to PayPal
	// For now, return a mock response
	
	orderID := fmt.Sprintf("%d-%s", time.Now().Unix(), uuid.New().String()[:8])
	
	return &PaymentResponse{
		TransactionID:    orderID,
		Status:          "CREATED",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "paypal",
		EstimatedArrival: time.Now().Add(1 * 24 * time.Hour),
		Fees:           req.Amount * 0.035 + 0.30, // 3.5% + $0.30
		AuthorizationURL: fmt.Sprintf("https://www.paypal.com/checkoutnow?token=%s", orderID),
		Metadata: map[string]interface{}{
			"order_id": orderID,
		},
	}, nil
}

func (pp *PayPalProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	// In a real implementation, this would query PayPal API
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "COMPLETED",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{
			"purchase_units": []map[string]interface{}{
				{
					"payments": map[string]interface{}{
						"captures": []map[string]interface{}{
							{
								"id":     fmt.Sprintf("capture_%d", time.Now().Unix()),
								"status": "COMPLETED",
								"amount": map[string]interface{}{
									"value":         "100.00",
									"currency_code": "USD",
								},
							},
						},
					},
				},
			},
		},
		ReceiptURL: fmt.Sprintf("https://www.paypal.com/activity/payment/%s", transactionID),
	}, nil
}

func (pp *PayPalProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	refundID := fmt.Sprintf("refund_%d_%s", time.Now().Unix(), uuid.New().String()[:8])
	
	return &RefundResponse{
		RefundID:      refundID,
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "COMPLETED",
		ProcessedAt:   time.Now(),
		Reason:        "Buyer requested refund",
	}, nil
}

func (pp *PayPalProcessor) GetSupportedCurrencies() []string {
	return []string{"USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR"}
}

func (pp *PayPalProcessor) GetName() string {
	return "PayPal"
}

// NewM_PesaProcessorImpl creates a new M-Pesa processor
func NewM_PesaProcessorImpl(config M_PesaConfig) *M_PesaProcessor {
	return &M_PesaProcessor{
		client: &http.Client{Timeout: 30 * time.Second},
		config: config,
	}
}

func (mp *M_PesaProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// M-Pesa STK Push request
	stkPush := map[string]interface{}{
		"BusinessShortCode": mp.config.Shortcode,
		"Password":          mp.generatePassword(),
		"Timestamp":         time.Now().Format("20060102150405"),
		"TransactionType":   "CustomerPayBillOnline",
		"Amount":            fmt.Sprintf("%.0f", req.Amount),
		"PartyA":            req.Recipient.Phone,
		"PartyB":            mp.config.Shortcode,
		"PhoneNumber":       req.Recipient.Phone,
		"CallBackURL":       "https://api.carbon-scribe.com/webhooks/m-pesa",
		"AccountReference":  req.ReferenceID,
		"TransactionDesc":   req.Description,
	}
	
	// In a real implementation, this would make an actual API call to M-Pesa
	// For now, return a mock response
	
	transactionID := fmt.Sprintf("MPESA%d%s", time.Now().Unix(), uuid.New().String()[:8])
	checkoutRequestID := fmt.Sprintf("ws_CO_%d_%s", time.Now().Unix(), uuid.New().String()[:8])
	
	return &PaymentResponse{
		TransactionID:    transactionID,
		Status:          "pending_confirmation",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "m_pesa",
		EstimatedArrival: time.Now().Add(5 * time.Minute),
		Fees:           req.Amount * 0.0, // M-Pesa fees are usually borne by sender
		QRCode:         fmt.Sprintf("data:image/png;base64,mock_qr_code_%s", transactionID),
		Metadata: map[string]interface{}{
			"checkout_request_id": checkoutRequestID,
			"merchant_request_id":  transactionID,
		},
	}, nil
}

func (mp *M_PesaProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	// In a real implementation, this would query M-Pesa API
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "KES", // M-Pesa uses Kenyan Shillings
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{
			"ResultCode": 0,
			"ResultDesc": "The service request is processed successfully.",
		},
	}, nil
}

func (mp *M_PesaProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	// M-Pesa doesn't support automatic refunds - would need manual process
	return &RefundResponse{
		RefundID:      fmt.Sprintf("refund_%d", time.Now().Unix()),
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "KES",
		Status:        "manual_processing_required",
		ProcessedAt:   time.Now(),
		Reason:        "M-Pesa refunds require manual processing",
	}, nil
}

func (mp *M_PesaProcessor) GetSupportedCurrencies() []string {
	return []string{"KES", "TZS", "UGX"} // Kenya, Tanzania, Uganda
}

func (mp *M_PesaProcessor) GetName() string {
	return "M-Pesa"
}

func (mp *M_PesaProcessor) generatePassword() string {
	// Generate M-Pesa password (in real implementation)
	timestamp := time.Now().Format("20060102150405")
	return fmt.Sprintf("%s%s%s", mp.config.Shortcode, mp.config.Passkey, timestamp)
}

// NewStellarPaymentProcessorImpl creates a new Stellar processor
func NewStellarPaymentProcessorImpl(config StellarConfig) *StellarPaymentProcessor {
	return &StellarPaymentProcessor{
		client: &http.Client{Timeout: 30 * time.Second},
		config: config,
	}
}

func (sp *StellarPaymentProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Create Stellar transaction
	transaction := map[string]interface{}{
		"source_account":     "G_ISSUER_ACCOUNT_ID", // Would be from config
		"destination":        req.Recipient.WalletDetails.Address,
		"amount":             fmt.Sprintf("%.7f", req.Amount), // Stellar uses 7 decimal places
		"asset_code":         req.Recipient.WalletDetails.Currency,
		"memo":               req.ReferenceID,
		"memo_type":          "text",
	}
	
	// In a real implementation, this would build and submit a Stellar transaction
	// For now, return a mock response
	
	transactionHash := fmt.Sprintf("stellar_tx_%d_%s", time.Now().Unix(), uuid.New().String()[:16])
	
	return &PaymentResponse{
		TransactionID:    transactionHash,
		Status:          "submitted",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "stellar_network",
		EstimatedArrival: time.Now().Add(5 * time.Second), // Stellar is fast
		Fees:           0.0001, // Minimal Stellar fee
		Metadata: map[string]interface{}{
			"transaction_hash": transactionHash,
			"ledger":           fmt.Sprintf("%d", time.Now().Unix()),
			"operations":       1,
		},
	}, nil
}

func (sp *StellarPaymentProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	// In a real implementation, this would query Stellar Horizon API
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{
			"successful": true,
			"ledger":     fmt.Sprintf("%d", time.Now().Unix()),
			"operations": 1,
		},
	}, nil
}

func (sp *StellarPaymentProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	// Stellar refunds are just reverse transactions
	refundHash := fmt.Sprintf("stellar_refund_%d_%s", time.Now().Unix(), uuid.New().String()[:16])
	
	return &RefundResponse{
		RefundID:      refundHash,
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "completed",
		ProcessedAt:   time.Now(),
		Reason:        "Stellar reverse transaction",
	}, nil
}

func (sp *StellarPaymentProcessor) GetSupportedCurrencies() []string {
	return []string{"XLM", "USDC", "EURT", "BTC", "ETH"}
}

func (sp *StellarPaymentProcessor) GetName() string {
	return "Stellar Network"
}

// NewBankTransferProcessorImpl creates a new bank transfer processor
func NewBankTransferProcessorImpl(config BankTransferConfig) *BankTransferProcessor {
	return &BankTransferProcessor{
		client: &http.Client{Timeout: 30 * time.Second},
		config: config,
	}
}

func (bp *BankTransferProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	// Create bank transfer instruction
	transfer := map[string]interface{}{
		"account_number": req.Recipient.BankDetails.AccountNumber,
		"routing_number": req.Recipient.BankDetails.RoutingNumber,
		"bank_name":      req.Recipient.BankDetails.BankName,
		"account_type":   req.Recipient.BankDetails.AccountType,
		"amount":         fmt.Sprintf("%.2f", req.Amount),
		"currency":       req.Currency,
		"reference":      req.ReferenceID,
		"description":    req.Description,
	}
	
	// In a real implementation, this would integrate with bank APIs or ACH networks
	// For now, return a mock response
	
	transactionID := fmt.Sprintf("bank_tx_%d_%s", time.Now().Unix(), uuid.New().String()[:8])
	
	return &PaymentResponse{
		TransactionID:    transactionID,
		Status:          "processing",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "bank_transfer",
		EstimatedArrival: time.Now().Add(3 * 24 * time.Hour), // 3 days for ACH
		Fees:           25.0, // Fixed wire transfer fee
		Metadata: map[string]interface{}{
			"transfer_type": "ACH",
			"bank_code":     bp.config.BankCode,
			"account_last4": req.Recipient.BankDetails.AccountNumber[len(req.Recipient.BankDetails.AccountNumber)-4:],
		},
	}, nil
}

func (bp *BankTransferProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	// In a real implementation, this would query bank API
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{
			"transfer_status": "settled",
			"clearing_date":  time.Now().AddDate(0, 0, 2).Format("2006-01-02"),
		},
	}, nil
}

func (bp *BankTransferProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	// Bank transfers typically require manual refund process
	return &RefundResponse{
		RefundID:      fmt.Sprintf("refund_%d", time.Now().Unix()),
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "manual_processing_required",
		ProcessedAt:   time.Now(),
		Reason:        "Bank transfers require manual refund processing",
	}, nil
}

func (bp *BankTransferProcessor) GetSupportedCurrencies() []string {
	return []string{"USD", "EUR", "GBP", "CAD", "AUD"}
}

func (bp *BankTransferProcessor) GetName() string {
	return "Bank Transfer"
}

// Helper function to make HTTP requests
func makeHTTPRequest(client *http.Client, method, url string, headers map[string]string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}
	
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}
	
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	return io.ReadAll(resp.Body)
}
