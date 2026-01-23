package payments

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// Local type definitions to avoid import cycle

// DistributionType represents the type of revenue distribution
type DistributionType string

const (
	DistributionTypeCreditSale  DistributionType = "credit_sale"
	DistributionTypeForwardSale DistributionType = "forward_sale"
	DistributionTypeRoyalty     DistributionType = "royalty"
	DistributionTypeBonus       DistributionType = "bonus"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "pending"
	PaymentStatusInitiated  PaymentStatus = "initiated"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusCompleted  PaymentStatus = "completed"
	PaymentStatusFailed     PaymentStatus = "failed"
	PaymentStatusRefunded   PaymentStatus = "refunded"
)

// Beneficiary represents a revenue beneficiary
type Beneficiary struct {
	UserID        uuid.UUID     `json:"user_id"`
	Percent       float64       `json:"percent"`
	Amount        float64       `json:"amount"`
	TaxWithheld   float64       `json:"tax_withheld"`
	NetAmount     float64       `json:"net_amount"`
	PaymentStatus PaymentStatus `json:"payment_status"`
}

// BeneficiaryArray is a slice of beneficiaries
type BeneficiaryArray []Beneficiary

// RevenueDistribution represents a revenue distribution record
type RevenueDistribution struct {
	ID                 uuid.UUID        `json:"id"`
	CreditSaleID       uuid.UUID        `json:"credit_sale_id"`
	DistributionType   DistributionType `json:"distribution_type"`
	TotalReceived      float64          `json:"total_received"`
	Currency           string           `json:"currency"`
	PlatformFeePercent float64          `json:"platform_fee_percent"`
	PlatformFeeAmount  float64          `json:"platform_fee_amount"`
	NetAmount          float64          `json:"net_amount"`
	Beneficiaries      BeneficiaryArray `json:"beneficiaries"`
	PaymentStatus      PaymentStatus    `json:"payment_status"`
	PaymentProcessedAt *time.Time       `json:"payment_processed_at,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

// PaymentTransaction represents a payment transaction
type PaymentTransaction struct {
	ID                     uuid.UUID              `json:"id"`
	UserID                 *uuid.UUID             `json:"user_id,omitempty"`
	Amount                 float64                `json:"amount"`
	Currency               string                 `json:"currency"`
	PaymentMethod          string                 `json:"payment_method"`
	PaymentProvider        string                 `json:"payment_provider"`
	Status                 PaymentStatus          `json:"status"`
	ExternalID             *string                `json:"external_id,omitempty"`
	StellarTransactionHash *string                `json:"stellar_transaction_hash,omitempty"`
	StellarAssetCode       *string                `json:"stellar_asset_code,omitempty"`
	FailureReason          *string                `json:"failure_reason,omitempty"`
	Metadata               map[string]interface{} `json:"metadata"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
}

// RevenueDistributionManager manages revenue distribution to stakeholders
type RevenueDistributionManager struct {
	repository         DistributionRepository
	paymentProcessors  map[string]PaymentProcessor
	taxCalculator      *TaxCalculator
	complianceChecker *ComplianceChecker
	config            *DistributionConfig
}

// DistributionRepository defines the interface for distribution data access
type DistributionRepository interface {
	CreateRevenueDistribution(ctx context.Context, distribution *RevenueDistribution) error
	GetRevenueDistribution(ctx context.Context, distributionID uuid.UUID) (*RevenueDistribution, error)
	UpdateRevenueDistribution(ctx context.Context, distribution *RevenueDistribution) error
	ListRevenueDistributions(ctx context.Context, filters *DistributionFilters) ([]*RevenueDistribution, error)
	CreatePaymentTransaction(ctx context.Context, transaction *PaymentTransaction) error
	GetPaymentTransaction(ctx context.Context, transactionID uuid.UUID) (*PaymentTransaction, error)
	UpdatePaymentTransaction(ctx context.Context, transaction *PaymentTransaction) error
	GetUserPaymentHistory(ctx context.Context, userID uuid.UUID) ([]*PaymentTransaction, error)
	GetProjectRevenue(ctx context.Context, projectID uuid.UUID) ([]*RevenueDistribution, error)
}

// DistributionFilters represents filters for listing distributions
type DistributionFilters struct {
	ProjectID       *uuid.UUID                        `json:"project_id,omitempty"`
	UserID          *uuid.UUID                        `json:"user_id,omitempty"`
	DistributionType *DistributionType      `json:"distribution_type,omitempty"`
	Status          *PaymentStatus          `json:"status,omitempty"`
	CreatedAfter    *time.Time                        `json:"created_after,omitempty"`
	CreatedBefore   *time.Time                        `json:"created_before,omitempty"`
	Limit           *int                              `json:"limit,omitempty"`
	Offset          *int                              `json:"offset,omitempty"`
}

// PaymentProcessor defines interface for payment processing
type PaymentProcessor interface {
	ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error)
	GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error)
	RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error)
	GetSupportedCurrencies() []string
	GetName() string
}

// TaxCalculator handles tax calculations
type TaxCalculator struct {
	rates map[string]TaxRate
}

// TaxRate represents tax rate for a jurisdiction
type TaxRate struct {
	Country     string  `json:"country"`
	Region      string  `json:"region"`
	IncomeTax   float64 `json:"income_tax"`
	WithholdingTax float64 `json:"withholding_tax"`
	VAT         float64 `json:"vat"`
	OtherTaxes  float64 `json:"other_taxes"`
}

// ComplianceChecker handles regulatory compliance
type ComplianceChecker struct {
	rules map[string]ComplianceRule
}

// ComplianceRule represents a compliance rule
type ComplianceRule struct {
	Jurisdiction string                 `json:"jurisdiction"`
	Type         string                 `json:"type"`
	Description  string                 `json:"description"`
	Requirements map[string]interface{} `json:"requirements"`
}

// DistributionConfig holds configuration for revenue distribution
type DistributionConfig struct {
	DefaultPlatformFee    float64 `json:"default_platform_fee"`    // Percentage
	MinPlatformFee         float64 `json:"min_platform_fee"`       // Minimum fee in USD
	MaxPlatformFee         float64 `json:"max_platform_fee"`       // Maximum fee in USD
	MinDistributionAmount  float64 `json:"min_distribution_amount"`  // Minimum amount per distribution
	MaxBatchSize           int     `json:"max_batch_size"`           // Max beneficiaries per batch
	PaymentTimeoutMinutes  int     `json:"payment_timeout_minutes"`  // Timeout for payment processing
	RetryAttempts          int     `json:"retry_attempts"`           // Number of retry attempts
	RetryDelayMinutes      int     `json:"retry_delay_minutes"`      // Delay between retries
	AutoApproveThreshold   float64 `json:"auto_approve_threshold"`   // Auto-approve amounts below threshold
}

// PaymentRequest represents a payment processing request
type PaymentRequest struct {
	Amount         float64                   `json:"amount"`
	Currency       string                    `json:"currency"`
	Recipient      PaymentRecipient          `json:"recipient"`
	PaymentMethod  string                    `json:"payment_method"`
	ReferenceID    string                    `json:"reference_id"`
	Description    string                    `json:"description"`
	Metadata       map[string]interface{}    `json:"metadata"`
	WebhookURL     string                    `json:"webhook_url"`
}

// PaymentRecipient represents a payment recipient
type PaymentRecipient struct {
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	Country     string    `json:"country"`
	BankDetails *BankDetails `json:"bank_details,omitempty"`
	WalletDetails *WalletDetails `json:"wallet_details,omitempty"`
}

// BankDetails represents bank account details
type BankDetails struct {
	AccountNumber string `json:"account_number"`
	RoutingNumber string `json:"routing_number"`
	BankName      string `json:"bank_name"`
	AccountType   string `json:"account_type"`
	Currency      string `json:"currency"`
}

// WalletDetails represents digital wallet details
type WalletDetails struct {
	Type        string `json:"type"`        // stellar, paypal, etc.
	Address     string `json:"address"`
	Network     string `json:"network"`
	Currency    string `json:"currency"`
}

// PaymentResponse represents a payment processing response
type PaymentResponse struct {
	TransactionID   string    `json:"transaction_id"`
	Status          string    `json:"status"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Processor       string    `json:"processor"`
	EstimatedArrival time.Time `json:"estimated_arrival"`
	Fees            float64   `json:"fees"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// PaymentStatusResponse represents payment status response
type PaymentStatusResponse struct {
	TransactionID string                   `json:"transaction_id"`
	Status        string                   `json:"status"`
	Amount        float64                  `json:"amount"`
	Currency      string                   `json:"currency"`
	ProcessedAt   *time.Time               `json:"processed_at,omitempty"`
	FailureReason *string                  `json:"failure_reason,omitempty"`
	ProviderStatus map[string]interface{}  `json:"provider_status"`
}

// RefundResponse represents refund response
type RefundResponse struct {
	RefundID      string    `json:"refund_id"`
	TransactionID string    `json:"transaction_id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	ProcessedAt   time.Time `json:"processed_at"`
}

// DistributionRequest represents a revenue distribution request
type DistributionRequest struct {
	CreditSaleID        uuid.UUID                        `json:"credit_sale_id" binding:"required"`
	DistributionType    DistributionType       `json:"distribution_type" binding:"required"`
	TotalReceived       float64                          `json:"total_received" binding:"required,gt=0"`
	Currency            string                           `json:"currency" binding:"required"`
	PlatformFeePercent  float64                          `json:"platform_fee_percent" binding:"required,min=0,max=100"`
	Beneficiaries       []BeneficiaryRequest             `json:"beneficiaries" binding:"required,min=1"`
	DistributionDate    *time.Time                       `json:"distribution_date,omitempty"`
	AutoDistribute      bool                             `json:"auto_distribute"`
}

// BeneficiaryRequest represents a beneficiary in distribution request
type BeneficiaryRequest struct {
	UserID       uuid.UUID `json:"user_id" binding:"required"`
	Percent      float64   `json:"percent" binding:"required,min=0,max=100"`
	Role         string    `json:"role"`         // farmer, landowner, community, etc.
	Jurisdiction string    `json:"jurisdiction"` // Country code for tax calculation
}

// DistributionResponse represents the response from distribution creation
type DistributionResponse struct {
	DistributionID     uuid.UUID                        `json:"distribution_id"`
	Status             PaymentStatus          `json:"status"`
	TotalAmount        float64                          `json:"total_amount"`
	PlatformFeeAmount  float64                          `json:"platform_fee_amount"`
	NetAmount          float64                          `json:"net_amount"`
	BeneficiaryCount   int                              `json:"beneficiary_count"`
	EstimatedPayouts  []EstimatedPayout                `json:"estimated_payouts"`
	CreatedAt          time.Time                        `json:"created_at"`
	ScheduledAt        *time.Time                       `json:"scheduled_at,omitempty"`
}

// EstimatedPayout represents estimated payout to a beneficiary
type EstimatedPayout struct {
	UserID        uuid.UUID `json:"user_id"`
	GrossAmount   float64   `json:"gross_amount"`
	TaxWithheld   float64   `json:"tax_withheld"`
	NetAmount     float64   `json:"net_amount"`
	Currency      string    `json:"currency"`
	PaymentMethod string    `json:"payment_method"`
}

// NewRevenueDistributionManager creates a new revenue distribution manager
func NewRevenueDistributionManager(repository DistributionRepository, config *DistributionConfig) *RevenueDistributionManager {
	if config == nil {
		config = &DistributionConfig{
			DefaultPlatformFee:   5.0,  // 5%
			MinPlatformFee:       1.0,  // $1 minimum
			MaxPlatformFee:       100.0, // $100 maximum
			MinDistributionAmount: 0.01, // $0.01 minimum
			MaxBatchSize:         100,
			PaymentTimeoutMinutes: 30,
			RetryAttempts:        3,
			RetryDelayMinutes:    5,
			AutoApproveThreshold: 1000.0, // $1000
		}
	}
	
	return &RevenueDistributionManager{
		repository:        repository,
		paymentProcessors: map[string]PaymentProcessor{
			"stripe":    NewStripeProcessor(),
			"paypal":     NewPayPalProcessor(),
			"stellar":    NewStellarProcessor(),
			"bank_transfer": NewBankTransferProcessor(),
		},
		taxCalculator:      NewTaxCalculator(),
		complianceChecker: NewComplianceChecker(),
		config:            config,
	}
}

// CreateDistribution creates a new revenue distribution
func (rdm *RevenueDistributionManager) CreateDistribution(ctx context.Context, req *DistributionRequest) (*DistributionResponse, error) {
	// Validate request
	if err := rdm.validateDistributionRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	// Calculate platform fee
	platformFeeAmount := req.TotalReceived * (req.PlatformFeePercent / 100.0)
	platformFeeAmount = math.Max(platformFeeAmount, rdm.config.MinPlatformFee)
	platformFeeAmount = math.Min(platformFeeAmount, rdm.config.MaxPlatformFee)
	
	netAmount := req.TotalReceived - platformFeeAmount
	
	// Process beneficiaries
	beneficiaries, err := rdm.processBeneficiaries(ctx, req.Beneficiaries, netAmount, req.Currency)
	if err != nil {
		return nil, fmt.Errorf("failed to process beneficiaries: %w", err)
	}
	
	// Create distribution
	distribution := &RevenueDistribution{
		ID:                 uuid.New(),
		CreditSaleID:       req.CreditSaleID,
		DistributionType:   req.DistributionType,
		TotalReceived:      req.TotalReceived,
		Currency:           req.Currency,
		PlatformFeePercent: req.PlatformFeePercent,
		PlatformFeeAmount:  platformFeeAmount,
		NetAmount:          netAmount,
		Beneficiaries:      beneficiaries,
		PaymentStatus:      PaymentStatusPending,
		CreatedAt:          time.Now(),
	}
	
	// Save to database
	if err := rdm.repository.CreateRevenueDistribution(ctx, distribution); err != nil {
		return nil, fmt.Errorf("failed to create distribution: %w", err)
	}
	
	// Generate estimated payouts
	estimatedPayouts := rdm.generateEstimatedPayouts(beneficiaries)
	
	// Auto-distribute if requested and amount is below threshold
	if req.AutoDistribute && netAmount <= rdm.config.AutoApproveThreshold {
		go rdm.processDistributionAsync(context.Background(), distribution.ID)
	}
	
	return &DistributionResponse{
		DistributionID:    distribution.ID,
		Status:           distribution.PaymentStatus,
		TotalAmount:      distribution.TotalReceived,
		PlatformFeeAmount: distribution.PlatformFeeAmount,
		NetAmount:        distribution.NetAmount,
		BeneficiaryCount: len(beneficiaries),
		EstimatedPayouts: estimatedPayouts,
		CreatedAt:       distribution.CreatedAt,
		ScheduledAt:     req.DistributionDate,
	}, nil
}

// ProcessDistribution processes a revenue distribution
func (rdm *RevenueDistributionManager) ProcessDistribution(ctx context.Context, distributionID uuid.UUID) error {
	distribution, err := rdm.repository.GetRevenueDistribution(ctx, distributionID)
	if err != nil {
		return fmt.Errorf("failed to get distribution: %w", err)
	}
	
	if distribution.PaymentStatus != PaymentStatusPending {
		return fmt.Errorf("distribution is not in pending status")
	}
	
	// Update status to processing
	distribution.PaymentStatus = PaymentStatusProcessing
	rdm.repository.UpdateRevenueDistribution(ctx, distribution)
	
	// Process payments in batches
	batchSize := rdm.config.MaxBatchSize
	beneficiaries := distribution.Beneficiaries
	
	for i := 0; i < len(beneficiaries); i += batchSize {
		end := i + batchSize
		if end > len(beneficiaries) {
			end = len(beneficiaries)
		}
		
		batch := beneficiaries[i:end]
		if err := rdm.processBatch(ctx, distribution, batch); err != nil {
			// Mark as failed and continue with next batch
			distribution.PaymentStatus = PaymentStatusFailed
			rdm.repository.UpdateRevenueDistribution(ctx, distribution)
			return fmt.Errorf("batch %d failed: %w", i/batchSize, err)
		}
	}
	
	// Update status to completed
	distribution.PaymentStatus = PaymentStatusCompleted
	now := time.Now()
	distribution.PaymentProcessedAt = &now
	rdm.repository.UpdateRevenueDistribution(ctx, distribution)
	
	return nil
}

// processBatch processes a batch of beneficiary payments
func (rdm *RevenueDistributionManager) processBatch(ctx context.Context, distribution *RevenueDistribution, beneficiaries []Beneficiary) error {
	batchID := fmt.Sprintf("batch_%s_%d", distribution.ID.String()[:8], time.Now().Unix())
	
	for _, beneficiary := range beneficiaries {
		// Create payment transaction
		transaction := &PaymentTransaction{
			ID:             uuid.New(),
			UserID:         &beneficiary.UserID,
			Amount:         beneficiary.Amount,
			Currency:       distribution.Currency,
			PaymentMethod:  "bank_transfer", // Default
			PaymentProvider: "stripe",       // Default
			Status:         PaymentStatusInitiated,
			Metadata: map[string]interface{}{
				"distribution_id": distribution.ID,
				"batch_id":        batchID,
				"role":            "beneficiary",
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		
		// Get user details and payment preferences
		paymentDetails, err := rdm.getUserPaymentDetails(ctx, beneficiary.UserID)
		if err != nil {
			transaction.Status = PaymentStatusFailed
			failureReason := fmt.Sprintf("Failed to get payment details: %v", err)
			transaction.FailureReason = &failureReason
			rdm.repository.CreatePaymentTransaction(ctx, transaction)
			continue
		}
		
		// Update transaction with payment details
		transaction.PaymentMethod = paymentDetails.PreferredMethod
		transaction.PaymentProvider = paymentDetails.PreferredProvider
		
		// Process payment
		if err := rdm.processPayment(ctx, transaction, paymentDetails); err != nil {
			transaction.Status = PaymentStatusFailed
			failureReason := fmt.Sprintf("Payment processing failed: %v", err)
			transaction.FailureReason = &failureReason
			rdm.repository.CreatePaymentTransaction(ctx, transaction)
			continue
		}
		
		// Save transaction
		if err := rdm.repository.CreatePaymentTransaction(ctx, transaction); err != nil {
			return fmt.Errorf("failed to save transaction: %w", err)
		}
	}
	
	return nil
}

// processPayment processes a single payment
func (rdm *RevenueDistributionManager) processPayment(ctx context.Context, transaction *PaymentTransaction, details *UserPaymentDetails) error {
	// Get payment processor
	processor, exists := rdm.paymentProcessors[transaction.PaymentProvider]
	if !exists {
		return fmt.Errorf("payment processor %s not found", transaction.PaymentProvider)
	}
	
	// Create payment request
	paymentReq := &PaymentRequest{
		Amount:      transaction.Amount,
		Currency:    transaction.Currency,
		Recipient: PaymentRecipient{
			UserID:   *transaction.UserID,
			Name:     details.Name,
			Email:    details.Email,
			Country:  details.Country,
		},
		PaymentMethod: transaction.PaymentMethod,
		ReferenceID:   transaction.ID.String(),
		Description:   fmt.Sprintf("Revenue distribution from CarbonScribe project"),
		Metadata:      transaction.Metadata,
	}
	
	// Add payment method specific details
	switch transaction.PaymentMethod {
	case "bank_transfer":
		paymentReq.Recipient.BankDetails = details.BankDetails
	case "stellar":
		paymentReq.Recipient.WalletDetails = details.WalletDetails
	}
	
	// Process payment
	response, err := processor.ProcessPayment(ctx, paymentReq)
	if err != nil {
		return fmt.Errorf("payment processing failed: %w", err)
	}
	
	// Update transaction with response
	transaction.ExternalID = &response.TransactionID
	transaction.Status = PaymentStatusProcessing
	
	// For blockchain payments, add blockchain details
	if transaction.PaymentProvider == "stellar_network" {
		// Parse blockchain transaction details from response
		if txHash, ok := response.Metadata["transaction_hash"].(string); ok {
			transaction.StellarTransactionHash = &txHash
		}
		if assetCode, ok := response.Metadata["asset_code"].(string); ok {
			transaction.StellarAssetCode = &assetCode
		}
	}
	
	return nil
}

// processBeneficiaries processes beneficiaries and calculates amounts
func (rdm *RevenueDistributionManager) processBeneficiaries(ctx context.Context, requests []BeneficiaryRequest, netAmount float64, currency string) (BeneficiaryArray, error) {
	// Validate percentages sum to 100
	totalPercent := 0.0
	for _, req := range requests {
		totalPercent += req.Percent
	}
	
	if math.Abs(totalPercent-100.0) > 0.01 { // Allow small rounding error
		return nil, fmt.Errorf("beneficiary percentages must sum to 100%% (got %.2f%%)", totalPercent)
	}
	
	beneficiaries := make(BeneficiaryArray, len(requests))
	
	for i, req := range requests {
		// Calculate gross amount
		grossAmount := netAmount * (req.Percent / 100.0)
		
		// Calculate tax withholding
		taxWithheld := rdm.calculateTax(ctx, grossAmount, req.Jurisdiction)
		
		// Calculate net amount
		netAmount := grossAmount - taxWithheld
		
		beneficiaries[i] = Beneficiary{
			UserID:       req.UserID,
			Percent:      req.Percent,
			Amount:       grossAmount,
			TaxWithheld:  taxWithheld,
			NetAmount:    netAmount,
			PaymentStatus: PaymentStatusPending,
		}
	}
	
	return beneficiaries, nil
}

// calculateTax calculates tax withholding for a beneficiary
func (rdm *RevenueDistributionManager) calculateTax(ctx context.Context, amount float64, jurisdiction string) float64 {
	taxRate := rdm.taxCalculator.GetTaxRate(jurisdiction)
	totalTaxRate := taxRate.WithholdingTax + taxRate.OtherTaxes
	return amount * (totalTaxRate / 100.0)
}

// generateEstimatedPayouts generates estimated payouts for response
func (rdm *RevenueDistributionManager) generateEstimatedPayouts(beneficiaries BeneficiaryArray) []EstimatedPayout {
	payouts := make([]EstimatedPayout, len(beneficiaries))
	
	for i, beneficiary := range beneficiaries {
		payouts[i] = EstimatedPayout{
			UserID:        beneficiary.UserID,
			GrossAmount:   beneficiary.Amount,
			TaxWithheld:   beneficiary.TaxWithheld,
			NetAmount:     beneficiary.NetAmount,
			Currency:      "USD", // Default
			PaymentMethod: "bank_transfer", // Default
		}
	}
	
	return payouts
}

// getUserPaymentDetails gets user's payment preferences and details
func (rdm *RevenueDistributionManager) getUserPaymentDetails(ctx context.Context, userID uuid.UUID) (*UserPaymentDetails, error) {
	// In a real implementation, this would query user service
	// For now, return mock details
	return &UserPaymentDetails{
		UserID:           userID,
		Name:             "John Farmer",
		Email:            "john.farmer@example.com",
		Country:          "US",
		PreferredMethod:  "bank_transfer",
		PreferredProvider: "stripe",
		BankDetails: &BankDetails{
			AccountNumber: "****1234",
			RoutingNumber: "123456789",
			BankName:      "First National Bank",
			AccountType:   "checking",
			Currency:      "USD",
		},
	}, nil
}

// validateDistributionRequest validates distribution request
func (rdm *RevenueDistributionManager) validateDistributionRequest(req *DistributionRequest) error {
	if req.TotalReceived <= rdm.config.MinDistributionAmount {
		return fmt.Errorf("total received must be at least %.2f", rdm.config.MinDistributionAmount)
	}
	
	if req.PlatformFeePercent < 0 || req.PlatformFeePercent > 50 {
		return fmt.Errorf("platform fee percent must be between 0 and 50")
	}
	
	if len(req.Beneficiaries) == 0 {
		return fmt.Errorf("at least one beneficiary is required")
	}
	
	if len(req.Beneficiaries) > rdm.config.MaxBatchSize {
		return fmt.Errorf("too many beneficiaries (max %d)", rdm.config.MaxBatchSize)
	}
	
	return nil
}

// processDistributionAsync processes distribution asynchronously
func (rdm *RevenueDistributionManager) processDistributionAsync(ctx context.Context, distributionID uuid.UUID) {
	if err := rdm.ProcessDistribution(ctx, distributionID); err != nil {
		// Log error for monitoring
		fmt.Printf("Async distribution processing failed for %s: %v\n", distributionID, err)
	}
}

// UserPaymentDetails represents user's payment preferences
type UserPaymentDetails struct {
	UserID            uuid.UUID    `json:"user_id"`
	Name              string       `json:"name"`
	Email             string       `json:"email"`
	Phone             string       `json:"phone"`
	Country           string       `json:"country"`
	PreferredMethod   string       `json:"preferred_method"`
	PreferredProvider string       `json:"preferred_provider"`
	BankDetails       *BankDetails `json:"bank_details,omitempty"`
	WalletDetails     *WalletDetails `json:"wallet_details,omitempty"`
}

// NewTaxCalculator creates a new tax calculator
func NewTaxCalculator() *TaxCalculator {
	return &TaxCalculator{
		rates: map[string]TaxRate{
			"US": {
				Country:        "US",
				IncomeTax:      22.0,
				WithholdingTax: 0.0,
				VAT:           0.0,
				OtherTaxes:    0.0,
			},
			"KE": {
				Country:        "KE",
				IncomeTax:      30.0,
				WithholdingTax: 15.0,
				VAT:           16.0,
				OtherTaxes:    5.0,
			},
			"BR": {
				Country:        "BR",
				IncomeTax:      27.5,
				WithholdingTax: 1.5,
				VAT:           17.0,
				OtherTaxes:    2.0,
			},
		},
	}
}

// GetTaxRate gets tax rate for jurisdiction
func (tc *TaxCalculator) GetTaxRate(jurisdiction string) TaxRate {
	if rate, exists := tc.rates[jurisdiction]; exists {
		return rate
	}
	
	// Default to US rates if jurisdiction not found
	return tc.rates["US"]
}

// NewComplianceChecker creates a new compliance checker
func NewComplianceChecker() *ComplianceChecker {
	return &ComplianceChecker{
		rules: map[string]ComplianceRule{
			"US": {
				Jurisdiction: "US",
				Type:         "payment",
				Description:  "US payment regulations",
				Requirements: map[string]interface{}{
					"max_amount": 10000.0,
					"verification_required": true,
				},
			},
		},
	}
}

// Payment processor implementations
type StripeProcessor struct{}
func NewStripeProcessor() *StripeProcessor { return &StripeProcessor{} }
func (p *StripeProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	return &PaymentResponse{
		TransactionID:    fmt.Sprintf("stripe_%d", time.Now().Unix()),
		Status:          "processing",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "stripe",
		EstimatedArrival: time.Now().Add(2 * 24 * time.Hour), // 2 days
		Fees:           req.Amount * 0.029 + 0.30, // 2.9% + $0.30
		Metadata:       map[string]interface{}{},
	}, nil
}
func (p *StripeProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{},
	}, nil
}
func (p *StripeProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	return &RefundResponse{
		RefundID:      fmt.Sprintf("refund_%d", time.Now().Unix()),
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "succeeded",
		ProcessedAt:   time.Now(),
	}, nil
}
func (p *StripeProcessor) GetSupportedCurrencies() []string { return []string{"USD", "EUR", "GBP"} }
func (p *StripeProcessor) GetName() string { return "Stripe" }

type PayPalProcessor struct{}
func NewPayPalProcessor() *PayPalProcessor { return &PayPalProcessor{} }
func (p *PayPalProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	return &PaymentResponse{
		TransactionID:    fmt.Sprintf("paypal_%d", time.Now().Unix()),
		Status:          "processing",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "paypal",
		EstimatedArrival: time.Now().Add(1 * 24 * time.Hour), // 1 day
		Fees:           req.Amount * 0.035 + 0.30, // 3.5% + $0.30
		Metadata:       map[string]interface{}{},
	}, nil
}
func (p *PayPalProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{},
	}, nil
}
func (p *PayPalProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	return &RefundResponse{
		RefundID:      fmt.Sprintf("refund_%d", time.Now().Unix()),
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "succeeded",
		ProcessedAt:   time.Now(),
	}, nil
}
func (p *PayPalProcessor) GetSupportedCurrencies() []string { return []string{"USD", "EUR", "GBP"} }
func (p *PayPalProcessor) GetName() string { return "PayPal" }

type StellarProcessor struct{}
func NewStellarProcessor() *StellarProcessor { return &StellarProcessor{} }
func (p *StellarProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	return &PaymentResponse{
		TransactionID:    fmt.Sprintf("stellar_%d", time.Now().Unix()),
		Status:          "processing",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "stellar_network",
		EstimatedArrival: time.Now().Add(5 * time.Minute), // 5 minutes
		Fees:           0.0001, // Minimal Stellar fees
		Metadata: map[string]interface{}{
			"transaction_hash": fmt.Sprintf("hash_%d", time.Now().Unix()),
			"asset_code":       "USDC",
		},
	}, nil
}
func (p *StellarProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{},
	}, nil
}
func (p *StellarProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	return &RefundResponse{
		RefundID:      fmt.Sprintf("refund_%d", time.Now().Unix()),
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "succeeded",
		ProcessedAt:   time.Now(),
	}, nil
}
func (p *StellarProcessor) GetSupportedCurrencies() []string { return []string{"USD", "XLM", "USDC"} }
func (p *StellarProcessor) GetName() string { return "Stellar Network" }

type BankTransferProcessor struct{}
func NewBankTransferProcessor() *BankTransferProcessor { return &BankTransferProcessor{} }
func (p *BankTransferProcessor) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	return &PaymentResponse{
		TransactionID:    fmt.Sprintf("bank_%d", time.Now().Unix()),
		Status:          "processing",
		Amount:          req.Amount,
		Currency:        req.Currency,
		Processor:       "bank_transfer",
		EstimatedArrival: time.Now().Add(3 * 24 * time.Hour), // 3 days
		Fees:           25.0, // Fixed wire transfer fee
		Metadata:       map[string]interface{}{},
	}, nil
}
func (p *BankTransferProcessor) GetPaymentStatus(ctx context.Context, transactionID string) (*PaymentStatusResponse, error) {
	return &PaymentStatusResponse{
		TransactionID: transactionID,
		Status:        "completed",
		Amount:        100.0,
		Currency:      "USD",
		ProcessedAt:   func() *time.Time { t := time.Now(); return &t }(),
		ProviderStatus: map[string]interface{}{},
	}, nil
}
func (p *BankTransferProcessor) RefundPayment(ctx context.Context, transactionID string, amount float64) (*RefundResponse, error) {
	return &RefundResponse{
		RefundID:      fmt.Sprintf("refund_%d", time.Now().Unix()),
		TransactionID: transactionID,
		Amount:        amount,
		Currency:      "USD",
		Status:        "succeeded",
		ProcessedAt:   time.Now(),
	}, nil
}
func (p *BankTransferProcessor) GetSupportedCurrencies() []string { return []string{"USD", "EUR", "GBP"} }
func (p *BankTransferProcessor) GetName() string { return "Bank Transfer" }
