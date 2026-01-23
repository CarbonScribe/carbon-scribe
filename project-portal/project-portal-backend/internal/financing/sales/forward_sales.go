package sales

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// Local type definitions to avoid import cycle

// ForwardSaleStatus represents the status of a forward sale agreement
type ForwardSaleStatus string

const (
	ForwardSaleStatusPending   ForwardSaleStatus = "pending"
	ForwardSaleStatusActive    ForwardSaleStatus = "active"
	ForwardSaleStatusCompleted ForwardSaleStatus = "completed"
	ForwardSaleStatusCancelled ForwardSaleStatus = "cancelled"
)

// PaymentMilestone represents a single payment milestone
type PaymentMilestone struct {
	ID          string     `json:"id"`
	Description string     `json:"description"`
	DueDate     time.Time  `json:"due_date"`
	Amount      float64    `json:"amount"`
	Percentage  float64    `json:"percentage"`
	Paid        bool       `json:"paid"`
	PaidAt      *time.Time `json:"paid_at"`
}

// PaymentSchedule represents milestone payment schedule
type PaymentSchedule []PaymentMilestone

// ForwardSaleAgreement represents a forward sale agreement
type ForwardSaleAgreement struct {
	ID            uuid.UUID `json:"id" db:"id"`
	ProjectID     uuid.UUID `json:"project_id" db:"project_id"`
	BuyerID       uuid.UUID `json:"buyer_id" db:"buyer_id"`
	VintageYear   int       `json:"vintage_year" db:"vintage_year"`

	// Terms
	TonsCommitted float64 `json:"tons_committed" db:"tons_committed"`
	PricePerTon   float64 `json:"price_per_ton" db:"price_per_ton"`
	Currency      string  `json:"currency" db:"currency"`
	TotalAmount   float64 `json:"total_amount" db:"total_amount"`
	DeliveryDate  time.Time `json:"delivery_date" db:"delivery_date"`

	// Payment
	DepositPercent       float64         `json:"deposit_percent" db:"deposit_percent"`
	DepositPaid          bool            `json:"deposit_paid" db:"deposit_paid"`
	DepositTransactionID *string         `json:"deposit_transaction_id" db:"deposit_transaction_id"`
	PaymentSchedule      PaymentSchedule `json:"payment_schedule" db:"payment_schedule"`

	// Legal
	ContractHash     *string    `json:"contract_hash" db:"contract_hash"`
	SignedBySellerAt *time.Time `json:"signed_by_seller_at" db:"signed_by_seller_at"`
	SignedByBuyerAt  *time.Time `json:"signed_by_buyer_at" db:"signed_by_buyer_at"`

	// Status
	Status ForwardSaleStatus `json:"status" db:"status"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// PricingQuoteResponse represents a pricing quote response
type PricingQuoteResponse struct {
	BasePrice        float64   `json:"base_price"`
	AdjustedPrice    float64   `json:"adjusted_price"`
	TotalPrice       float64   `json:"total_price"`
	Currency         string    `json:"currency"`
	ValidUntil       time.Time `json:"valid_until"`
	PricingFactors   []string  `json:"pricing_factors"`
	MarketConditions string    `json:"market_conditions"`
}

// ForwardSaleManager manages forward sale agreements
type ForwardSaleManager struct {
	repository   ForwardSaleRepository
	pricingEngine *PricingEngine
	contractGen  *ContractGenerator
	escrow       *EscrowManager
	config       *ForwardSaleConfig
}

// ForwardSaleRepository defines the interface for forward sale data access
type ForwardSaleRepository interface {
	CreateForwardSale(ctx context.Context, sale *ForwardSaleAgreement) error
	GetForwardSale(ctx context.Context, saleID uuid.UUID) (*ForwardSaleAgreement, error)
	UpdateForwardSale(ctx context.Context, sale *ForwardSaleAgreement) error
	ListForwardSales(ctx context.Context, filters *ForwardSaleFilters) ([]*ForwardSaleAgreement, error)
	GetProjectForwardSales(ctx context.Context, projectID uuid.UUID) ([]*ForwardSaleAgreement, error)
	GetBuyerForwardSales(ctx context.Context, buyerID uuid.UUID) ([]*ForwardSaleAgreement, error)
}

// ForwardSaleFilters represents filters for listing forward sales
type ForwardSaleFilters struct {
	ProjectID     *uuid.UUID            `json:"project_id,omitempty"`
	BuyerID       *uuid.UUID            `json:"buyer_id,omitempty"`
	Status        []ForwardSaleStatus `json:"status,omitempty"`
	VintageYear   *int                  `json:"vintage_year,omitempty"`
	DeliveryDate  *time.Time            `json:"delivery_date,omitempty"`
	CreatedAfter  *time.Time            `json:"created_after,omitempty"`
	CreatedBefore *time.Time            `json:"created_before,omitempty"`
	Limit         *int                  `json:"limit,omitempty"`
	Offset        *int                  `json:"offset,omitempty"`
}

// ForwardSaleConfig holds configuration for forward sales
type ForwardSaleConfig struct {
	MinDepositPercent      float64 `json:"min_deposit_percent"`
	MaxDepositPercent      float64 `json:"max_deposit_percent"`
	DefaultDepositPercent  float64 `json:"default_deposit_percent"`
	MinDeliveryDays        int     `json:"min_delivery_days"`
	MaxDeliveryDays        int     `json:"max_delivery_days"`
	ContractValidityDays   int     `json:"contract_validity_days"`
	AutoCancelDays         int     `json:"auto_cancel_days"`
	PriceAdjustmentRate    float64 `json:"price_adjustment_rate"`
}

// ContractGenerator handles legal contract generation
type ContractGenerator struct {
	templatePath string
	signingService *SigningService
}

// SigningService handles digital signatures
type SigningService struct {
	provider string
	config   map[string]interface{}
}

// EscrowManager manages escrow accounts
type EscrowManager struct {
	provider string
	config   map[string]interface{}
}

// ForwardSaleRequest represents a forward sale creation request
type ForwardSaleRequest struct {
	ProjectID      uuid.UUID                     `json:"project_id" binding:"required"`
	BuyerID        uuid.UUID                     `json:"buyer_id" binding:"required"`
	VintageYear    int                           `json:"vintage_year" binding:"required"`
	TonsCommitted  float64                       `json:"tons_committed" binding:"required,gt=0"`
	PricePerTon    float64                       `json:"price_per_ton" binding:"required,gt=0"`
	Currency       string                        `json:"currency" binding:"required"`
	DeliveryDate   time.Time                     `json:"delivery_date" binding:"required"`
	DepositPercent float64                       `json:"deposit_percent" binding:"required,min=0,max=100"`
	PaymentSchedule PaymentSchedule     `json:"payment_schedule"`
	ContractTerms  map[string]interface{}        `json:"contract_terms"`
}

// ForwardSaleResponse represents the response from forward sale creation
type ForwardSaleResponse struct {
	SaleID          uuid.UUID                     `json:"sale_id"`
	ContractURL     string                        `json:"contract_url"`
	DepositAmount   float64                       `json:"deposit_amount"`
	TotalAmount     float64                       `json:"total_amount"`
	PaymentSchedule PaymentSchedule     `json:"payment_schedule"`
	Status          ForwardSaleStatus    `json:"status"`
	CreatedAt       time.Time                     `json:"created_at"`
	ExpiresAt       time.Time                     `json:"expires_at"`
}

// NewForwardSaleManager creates a new forward sale manager
func NewForwardSaleManager(repository ForwardSaleRepository, pricingEngine *PricingEngine, config *ForwardSaleConfig) *ForwardSaleManager {
	if config == nil {
		config = &ForwardSaleConfig{
			MinDepositPercent:     10.0,
			MaxDepositPercent:     50.0,
			DefaultDepositPercent: 20.0,
			MinDeliveryDays:       30,
			MaxDeliveryDays:       1095, // 3 years
			ContractValidityDays:   30,
			AutoCancelDays:         7,
			PriceAdjustmentRate:    0.05, // 5% annual
		}
	}
	
	return &ForwardSaleManager{
		repository:    repository,
		pricingEngine: pricingEngine,
		contractGen:   NewContractGenerator(),
		escrow:        NewEscrowManager(),
		config:        config,
	}
}

// CreateForwardSale creates a new forward sale agreement
func (fsm *ForwardSaleManager) CreateForwardSale(ctx context.Context, req *ForwardSaleRequest) (*ForwardSaleResponse, error) {
	// Validate request
	if err := fsm.validateRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	// Get pricing quote to validate price
	quoteReq := &PricingQuoteRequest{
		MethodologyCode: "", // Will be determined from project
		RegionCode:      "", // Will be determined from project
		VintageYear:     req.VintageYear,
		Tons:            req.TonsCommitted,
	}
	
	// In a real implementation, get project details to fill methodology and region
	quoteReq.MethodologyCode = "VM0007" // Default for demo
	quoteReq.RegionCode = "AF"         // Default for demo
	
	quote, err := fsm.pricingEngine.GetPriceQuote(ctx, quoteReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get price quote: %w", err)
	}
	
	// Validate price is within reasonable range
	if err := fsm.validatePrice(req.PricePerTon, quote); err != nil {
		return nil, fmt.Errorf("price validation failed: %w", err)
	}
	
	// Calculate payment schedule if not provided
	paymentSchedule := req.PaymentSchedule
	if len(paymentSchedule) == 0 {
		paymentSchedule = fsm.generateDefaultPaymentSchedule(req)
	}
	
	// Create forward sale agreement
	sale := &ForwardSaleAgreement{
		ID:             uuid.New(),
		ProjectID:      req.ProjectID,
		BuyerID:        req.BuyerID,
		VintageYear:    req.VintageYear,
		TonsCommitted:  req.TonsCommitted,
		PricePerTon:    req.PricePerTon,
		Currency:       req.Currency,
		TotalAmount:    req.TonsCommitted * req.PricePerTon,
		DeliveryDate:   req.DeliveryDate,
		DepositPercent: req.DepositPercent,
		DepositPaid:    false,
		PaymentSchedule: paymentSchedule,
		Status:         ForwardSaleStatusPending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	
	// Save to database
	if err := fsm.repository.CreateForwardSale(ctx, sale); err != nil {
		return nil, fmt.Errorf("failed to create forward sale: %w", err)
	}
	
	// Generate contract
	contractURL, err := fsm.contractGen.GenerateContract(ctx, sale, req.ContractTerms)
	if err != nil {
		return nil, fmt.Errorf("failed to generate contract: %w", err)
	}
	
	// Create escrow account for deposit
	depositAmount := sale.TotalAmount * (sale.DepositPercent / 100.0)
	escrowAccount, err := fsm.escrow.CreateEscrowAccount(ctx, sale.ID, depositAmount, sale.Currency)
	if err != nil {
		return nil, fmt.Errorf("failed to create escrow account: %w", err)
	}
	
	// Update sale with contract hash
	sale.ContractHash = &contractURL
	
	// Calculate expiration date
	expiresAt := time.Now().AddDate(0, 0, fsm.config.ContractValidityDays)
	
	return &ForwardSaleResponse{
		SaleID:          sale.ID,
		ContractURL:     contractURL,
		DepositAmount:   depositAmount,
		TotalAmount:     sale.TotalAmount,
		PaymentSchedule: paymentSchedule,
		Status:          sale.Status,
		CreatedAt:       sale.CreatedAt,
		ExpiresAt:       expiresAt,
	}, nil
}

// GetForwardSale retrieves a forward sale by ID
func (fsm *ForwardSaleManager) GetForwardSale(ctx context.Context, saleID uuid.UUID) (*ForwardSaleAgreement, error) {
	return fsm.repository.GetForwardSale(ctx, saleID)
}

// ListForwardSales lists forward sales with filters
func (fsm *ForwardSaleManager) ListForwardSales(ctx context.Context, filters *ForwardSaleFilters) ([]*ForwardSaleAgreement, error) {
	return fsm.repository.ListForwardSales(ctx, filters)
}

// ActivateForwardSale activates a forward sale after contract signing
func (fsm *ForwardSaleManager) ActivateForwardSale(ctx context.Context, saleID uuid.UUID, signerRole string) error {
	sale, err := fsm.repository.GetForwardSale(ctx, saleID)
	if err != nil {
		return fmt.Errorf("failed to get forward sale: %w", err)
	}
	
	if sale.Status != ForwardSaleStatusPending {
		return fmt.Errorf("forward sale is not in pending status")
	}
	
	// Update signing timestamp
	now := time.Now()
	if signerRole == "seller" {
		sale.SignedBySellerAt = &now
	} else if signerRole == "buyer" {
		sale.SignedByBuyerAt = &now
	}
	
	// Check if both parties have signed
	if sale.SignedBySellerAt != nil && sale.SignedByBuyerAt != nil {
		sale.Status = ForwardSaleStatusActive
		sale.UpdatedAt = now
		
		// Activate escrow
		if err := fsm.escrow.ActivateEscrow(ctx, saleID); err != nil {
			return fmt.Errorf("failed to activate escrow: %w", err)
		}
	}
	
	// Update in database
	return fsm.repository.UpdateForwardSale(ctx, sale)
}

// ProcessDeposit processes the deposit payment
func (fsm *ForwardSaleManager) ProcessDeposit(ctx context.Context, saleID uuid.UUID, transactionID string) error {
	sale, err := fsm.repository.GetForwardSale(ctx, saleID)
	if err != nil {
		return fmt.Errorf("failed to get forward sale: %w", err)
	}
	
	if sale.Status != ForwardSaleStatusActive {
		return fmt.Errorf("forward sale is not active")
	}
	
	if sale.DepositPaid {
		return fmt.Errorf("deposit already paid")
	}
	
	// Verify deposit in escrow
	depositAmount := sale.TotalAmount * (sale.DepositPercent / 100.0)
	if err := fsm.escrow.VerifyDeposit(ctx, saleID, transactionID, depositAmount); err != nil {
		return fmt.Errorf("deposit verification failed: %w", err)
	}
	
	// Update sale
	sale.DepositPaid = true
	sale.DepositTransactionID = &transactionID
	sale.UpdatedAt = time.Now()
	
	return fsm.repository.UpdateForwardSale(ctx, sale)
}

// ProcessMilestonePayment processes a milestone payment
func (fsm *ForwardSaleManager) ProcessMilestonePayment(ctx context.Context, saleID uuid.UUID, milestoneID string, transactionID string) error {
	sale, err := fsm.repository.GetForwardSale(ctx, saleID)
	if err != nil {
		return fmt.Errorf("failed to get forward sale: %w", err)
	}
	
	if sale.Status != ForwardSaleStatusActive {
		return fmt.Errorf("forward sale is not active")
	}
	
	// Find and update milestone
	for i, milestone := range sale.PaymentSchedule {
		if milestone.ID == milestoneID {
			if milestone.Paid {
				return fmt.Errorf("milestone already paid")
			}
			
			// Verify payment
			if err := fsm.escrow.VerifyPayment(ctx, saleID, transactionID, milestone.Amount); err != nil {
				return fmt.Errorf("payment verification failed: %w", err)
			}
			
			// Update milestone
			sale.PaymentSchedule[i].Paid = true
			paidAt := time.Now()
			sale.PaymentSchedule[i].PaidAt = &paidAt
			sale.UpdatedAt = time.Now()
			
			return fsm.repository.UpdateForwardSale(ctx, sale)
		}
	}
	
	return fmt.Errorf("milestone not found")
}

// CompleteForwardSale completes a forward sale after credit delivery
func (fsm *ForwardSaleManager) CompleteForwardSale(ctx context.Context, saleID uuid.UUID, deliveredTons float64) error {
	sale, err := fsm.repository.GetForwardSale(ctx, saleID)
	if err != nil {
		return fmt.Errorf("failed to get forward sale: %w", err)
	}
	
	if sale.Status != ForwardSaleStatusActive {
		return fmt.Errorf("forward sale is not active")
	}
	
	// Verify delivery (allow for small variance)
	variance := math.Abs(deliveredTons - sale.TonsCommitted) / sale.TonsCommitted
	if variance > 0.05 { // 5% variance allowed
		return fmt.Errorf("delivered amount variance too high: %.2f%%", variance*100)
	}
	
	// Update status
	sale.Status = ForwardSaleStatusCompleted
	sale.UpdatedAt = time.Now()
	
	// Release escrow funds
	if err := fsm.escrow.ReleaseFunds(ctx, saleID); err != nil {
		return fmt.Errorf("failed to release escrow funds: %w", err)
	}
	
	return fsm.repository.UpdateForwardSale(ctx, sale)
}

// CancelForwardSale cancels a forward sale
func (fsm *ForwardSaleManager) CancelForwardSale(ctx context.Context, saleID uuid.UUID, reason string) error {
	sale, err := fsm.repository.GetForwardSale(ctx, saleID)
	if err != nil {
		return fmt.Errorf("failed to get forward sale: %w", err)
	}
	
	if sale.Status == ForwardSaleStatusCompleted {
		return fmt.Errorf("cannot cancel completed forward sale")
	}
	
	// Handle escrow refund if deposit was paid
	if sale.DepositPaid {
		if err := fsm.escrow.RefundDeposit(ctx, saleID, reason); err != nil {
			return fmt.Errorf("failed to refund deposit: %w", err)
		}
	}
	
	// Update status
	sale.Status = ForwardSaleStatusCancelled
	sale.UpdatedAt = time.Now()
	
	return fsm.repository.UpdateForwardSale(ctx, sale)
}

// validateRequest validates forward sale request
func (fsm *ForwardSaleManager) validateRequest(req *ForwardSaleRequest) error {
	// Validate deposit percentage
	if req.DepositPercent < fsm.config.MinDepositPercent || req.DepositPercent > fsm.config.MaxDepositPercent {
		return fmt.Errorf("deposit percent must be between %.1f%% and %.1f%%", 
			fsm.config.MinDepositPercent, fsm.config.MaxDepositPercent)
	}
	
	// Validate delivery date
	deliveryDays := int(req.DeliveryDate.Sub(time.Now()).Hours() / 24)
	if deliveryDays < fsm.config.MinDeliveryDays || deliveryDays > fsm.config.MaxDeliveryDays {
		return fmt.Errorf("delivery date must be between %d and %d days from now", 
			fsm.config.MinDeliveryDays, fsm.config.MaxDeliveryDays)
	}
	
	// Validate vintage year
	currentYear := time.Now().Year()
	if req.VintageYear < currentYear-2 || req.VintageYear > currentYear+2 {
		return fmt.Errorf("vintage year must be within 2 years of current year")
	}
	
	return nil
}

// validatePrice validates price against market quote
func (fsm *ForwardSaleManager) validatePrice(requestedPrice float64, quote *PricingQuoteResponse) error {
	// Allow 20% variance from market price
	minPrice := quote.BasePrice * 0.8
	maxPrice := quote.BasePrice * 1.2
	
	if requestedPrice < minPrice || requestedPrice > maxPrice {
		return fmt.Errorf("price %.2f is outside acceptable range [%.2f, %.2f]", 
			requestedPrice, minPrice, maxPrice)
	}
	
	return nil
}

// generateDefaultPaymentSchedule generates default payment schedule
func (fsm *ForwardSaleManager) generateDefaultPaymentSchedule(req *ForwardSaleRequest) PaymentSchedule {
	totalAmount := req.TonsCommitted * req.PricePerTon
	depositAmount := totalAmount * (req.DepositPercent / 100.0)
	remainingAmount := totalAmount - depositAmount
	
	schedule := PaymentSchedule{
		{
			ID:          "deposit",
			Description: "Initial deposit",
			DueDate:     time.Now().AddDate(0, 0, 7), // 7 days
			Amount:      depositAmount,
			Percentage:  req.DepositPercent,
			Paid:        false,
		},
	}
	
	// Add milestone payments (50% at delivery, 50% 30 days after)
	milestone1Amount := remainingAmount * 0.5
	milestone2Amount := remainingAmount * 0.5
	
	schedule = append(schedule,
PaymentMilestone{
			ID:          "delivery",
			Description: "Payment at delivery",
			DueDate:     req.DeliveryDate,
			Amount:      milestone1Amount,
			Percentage:  50.0,
			Paid:        false,
		},
PaymentMilestone{
			ID:          "final",
			Description: "Final payment",
			DueDate:     req.DeliveryDate.AddDate(0, 0, 30),
			Amount:      milestone2Amount,
			Percentage:  50.0,
			Paid:        false,
		},
	)
	
	return schedule
}

// NewContractGenerator creates a new contract generator
func NewContractGenerator() *ContractGenerator {
	return &ContractGenerator{
		templatePath:   "/templates/forward_sale.html",
		signingService: NewSigningService(),
	}
}

// GenerateContract generates a legal contract
func (cg *ContractGenerator) GenerateContract(ctx context.Context, sale *ForwardSaleAgreement, terms map[string]interface{}) (string, error) {
	// In a real implementation, this would:
	// 1. Load contract template
	// 2. Fill in template with sale details
	// 3. Generate PDF
	// 4. Store in document management system
	// 5. Return URL
	
	contractURL := fmt.Sprintf("https://contracts.carbon-scribe.com/forward-sale/%s.pdf", sale.ID)
	return contractURL, nil
}

// NewSigningService creates a new signing service
func NewSigningService() *SigningService {
	return &SigningService{
		provider: "docusign",
		config:   make(map[string]interface{}),
	}
}

// NewEscrowManager creates a new escrow manager
func NewEscrowManager() *EscrowManager {
	return &EscrowManager{
		provider: "stripe",
		config:   make(map[string]interface{}),
	}
}

// CreateEscrowAccount creates an escrow account
func (em *EscrowManager) CreateEscrowAccount(ctx context.Context, saleID uuid.UUID, amount float64, currency string) (string, error) {
	// In a real implementation, this would create an escrow account with the provider
	escrowAccountID := fmt.Sprintf("escrow_%s", saleID.String())
	return escrowAccountID, nil
}

// ActivateEscrow activates an escrow account
func (em *EscrowManager) ActivateEscrow(ctx context.Context, saleID uuid.UUID) error {
	// In a real implementation, this would activate the escrow account
	return nil
}

// VerifyDeposit verifies a deposit payment
func (em *EscrowManager) VerifyDeposit(ctx context.Context, saleID uuid.UUID, transactionID string, amount float64) error {
	// In a real implementation, this would verify the deposit with the payment provider
	return nil
}

// VerifyPayment verifies a milestone payment
func (em *EscrowManager) VerifyPayment(ctx context.Context, saleID uuid.UUID, transactionID string, amount float64) error {
	// In a real implementation, this would verify the payment with the payment provider
	return nil
}

// ReleaseFunds releases funds from escrow
func (em *EscrowManager) ReleaseFunds(ctx context.Context, saleID uuid.UUID) error {
	// In a real implementation, this would release funds to the seller
	return nil
}

// RefundDeposit refunds a deposit
func (em *EscrowManager) RefundDeposit(ctx context.Context, saleID uuid.UUID, reason string) error {
	// In a real implementation, this would refund the deposit to the buyer
	return nil
}
