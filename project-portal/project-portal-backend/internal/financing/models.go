package financing

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// CarbonCredit represents calculated and/or minted carbon credits
type CarbonCredit struct {
	ID                     uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProjectID              uuid.UUID      `json:"project_id" gorm:"type:uuid;not null;index"`
	VintageYear            int           `json:"vintage_year" gorm:"not null;index"`
	CalculationPeriodStart time.Time     `json:"calculation_period_start" gorm:"type:date;not null"`
	CalculationPeriodEnd   time.Time     `json:"calculation_period_end" gorm:"type:date;not null"`

	// Credit details
	MethodologyCode  string  `json:"methodology_code" gorm:"not null;index"` // 'VM0007', 'VM0015', etc.
	CalculatedTons   float64 `json:"calculated_tons" gorm:"type:decimal(12,4);not null"`
	BufferedTons     float64 `json:"buffered_tons" gorm:"type:decimal(12,4);not null"`
	IssuedTons       *float64 `json:"issued_tons" gorm:"type:decimal(12,4)"` // Actually minted tokens
	DataQualityScore *float64 `json:"data_quality_score" gorm:"type:decimal(3,2)"`

	// Calculation metadata
	CalculationInputs   datatypes.JSON `json:"calculation_inputs" gorm:"default:'{}'"`
	CalculationSteps    datatypes.JSON `json:"calculation_steps" gorm:"default:'[]'"`
	UncertaintyFactors  datatypes.JSON `json:"uncertainty_factors" gorm:"default:'{}'"`
	BaselineScenario    datatypes.JSON `json:"baseline_scenario" gorm:"default:'{}'"`

	// Stellar integration
	StellarAssetCode     *string       `json:"stellar_asset_code" gorm:"index"`     // e.g., 'CARBON001'
	StellarAssetIssuer   *string       `json:"stellar_asset_issuer" gorm:"index"`   // G... address
	TokenIDs             datatypes.JSON `json:"token_ids" gorm:"default:'[]'"`      // Array of minted token IDs
	MintTransactionHash *string       `json:"mint_transaction_hash" gorm:"index"`
	MintedAt             *time.Time    `json:"minted_at"`

	// Status and verification
	Status        CreditStatus `json:"status" gorm:"default:'calculated';index"`
	VerificationID *uuid.UUID  `json:"verification_id" gorm:"type:uuid"`
	VerifiedBy    *uuid.UUID   `json:"verified_by" gorm:"type:uuid"`
	VerifiedAt    *time.Time   `json:"verified_at"`

	// Audit trail
	CreatedBy uuid.UUID  `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updated_at" gorm:"autoUpdateTime"`

	// Associations
	Project     Project      `json:"project" gorm:"foreignKey:ProjectID"`
	Verifier    *User        `json:"verifier" gorm:"foreignKey:VerifiedBy"`
	Creator     User         `json:"creator" gorm:"foreignKey:CreatedBy"`
}

// CreditStatus represents the lifecycle status of carbon credits
type CreditStatus string

const (
	CreditStatusCalculated CreditStatus = "calculated"
	CreditStatusVerified   CreditStatus = "verified"
	CreditStatusMinting    CreditStatus = "minting"
	CreditStatusMinted     CreditStatus = "minted"
	CreditStatusRetired    CreditStatus = "retired"
	CreditStatusCancelled  CreditStatus = "cancelled"
)

// ForwardSaleAgreement represents forward sale contracts for future carbon credit delivery
type ForwardSaleAgreement struct {
	ID          uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProjectID   uuid.UUID  `json:"project_id" gorm:"type:uuid;not null;index"`
	BuyerID     uuid.UUID  `json:"buyer_id" gorm:"type:uuid;not null;index"`
	SellerID    uuid.UUID  `json:"seller_id" gorm:"type:uuid;not null"`
	VintageYear int       `json:"vintage_year" gorm:"not null;index"`

	// Terms
	TonsCommitted float64 `json:"tons_committed" gorm:"type:decimal(12,4);not null"`
	TonsDelivered float64 `json:"tons_delivered" gorm:"type:decimal(12,4);default:0"`
	PricePerTon   float64 `json:"price_per_ton" gorm:"type:decimal(10,4);not null"`
	Currency      string  `json:"currency" gorm:"default:'USD'"`
	TotalAmount   float64 `json:"total_amount" gorm:"type:decimal(14,4);not null"`
	DeliveryDate  time.Time `json:"delivery_date" gorm:"type:date;not null;index"`

	// Payment terms
	DepositPercent        float64       `json:"deposit_percent" gorm:"type:decimal(5,2);not null;default:10.0"`
	DepositAmount         float64       `json:"deposit_amount" gorm:"type:decimal(14,4)"`
	DepositPaid           bool          `json:"deposit_paid" gorm:"default:false"`
	DepositTransactionID  *string       `json:"deposit_transaction_id"`
	PaymentSchedule       datatypes.JSON `json:"payment_schedule" gorm:"default:'[]'"`
	PaymentTerms          datatypes.JSON `json:"payment_terms" gorm:"default:'{}'"`

	// Legal and compliance
	ContractTemplateID   *string       `json:"contract_template_id"`
	ContractHash         *string       `json:"contract_hash"`
	ContractVersion      int           `json:"contract_version" gorm:"default:1"`
	SignedBySellerAt     *time.Time    `json:"signed_by_seller_at"`
	SignedByBuyerAt      *time.Time    `json:"signed_by_buyer_at"`
	DigitalSignatures    datatypes.JSON `json:"digital_signatures" gorm:"default:'{}'"`

	// Risk and guarantees
	PerformanceBondRequired bool    `json:"performance_bond_required" gorm:"default:false"`
	PerformanceBondAmount   *float64 `json:"performance_bond_amount" gorm:"type:decimal(14,4)"`
	InsuranceRequired        bool    `json:"insurance_required" gorm:"default:false"`
	ForceMajeureClause      bool    `json:"force_majeure_clause" gorm:"default:true"`

	// Status
	Status            ForwardSaleStatus `json:"status" gorm:"default:'pending';index"`
	CancellationReason *string          `json:"cancellation_reason"`
	DisputeDetails    datatypes.JSON    `json:"dispute_details" gorm:"default:'{}'"`

	// Audit
	CreatedBy uuid.UUID `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Associations
	Project Project `json:"project" gorm:"foreignKey:ProjectID"`
	Buyer   User    `json:"buyer" gorm:"foreignKey:BuyerID"`
	Seller  User    `json:"seller" gorm:"foreignKey:SellerID"`
	Creator User    `json:"creator" gorm:"foreignKey:CreatedBy"`
}

// ForwardSaleStatus represents the status of forward sale agreements
type ForwardSaleStatus string

const (
	ForwardSaleStatusPending          ForwardSaleStatus = "pending"
	ForwardSaleStatusActive           ForwardSaleStatus = "active"
	ForwardSaleStatusPartiallyDelivered ForwardSaleStatus = "partially_delivered"
	ForwardSaleStatusCompleted        ForwardSaleStatus = "completed"
	ForwardSaleStatusCancelled        ForwardSaleStatus = "cancelled"
	ForwardSaleStatusDisputed         ForwardSaleStatus = "disputed"
)

// RevenueDistribution represents revenue sharing and distribution records
type RevenueDistribution struct {
	ID              uuid.UUID          `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreditSaleID    uuid.UUID          `json:"credit_sale_id" gorm="not null;index"`
	DistributionType DistributionType   `json:"distribution_type" gorm:"not null;index"`

	// Amounts
	TotalReceived       float64       `json:"total_received" gorm:"type:decimal(14,4);not null"`
	Currency            string        `json:"currency" gorm:"not null"`
	ExchangeRate        *float64      `json:"exchange_rate" gorm:"type:decimal(10,6)"`
	PlatformFeePercent  float64       `json:"platform_fee_percent" gorm:"type:decimal(5,2);not null"`
	PlatformFeeAmount   float64       `json:"platform_fee_amount" gorm:"type:decimal(12,4);not null"`
	NetAmount           float64       `json:"net_amount" gorm:"type:decimal(14,4);not null"`

	// Distribution splits
	Beneficiaries     datatypes.JSON `json:"beneficiaries" gorm:"default:'[]'"`
	DistributionRules datatypes.JSON `json:"distribution_rules" gorm:"default:'{}'"`

	// Payment execution
	PaymentBatchID    *string       `json:"payment_batch_id"`
	PaymentStatus     PaymentStatus `json:"payment_status" gorm:"default:'pending';index"`
	PaymentProcessedAt *time.Time   `json:"payment_processed_at"`
	FailureReason     *string       `json:"failure_reason"`
	RetryCount        int           `json:"retry_count" gorm:"default:0"`

	// Compliance
	TaxWithheldTotal    float64       `json:"tax_withheld_total" gorm:"type:decimal(12,4);default:0"`
	TaxJurisdictions    datatypes.JSON `json:"tax_jurisdictions" gorm:"default:'[]'"`
	ComplianceDocuments datatypes.JSON `json:"compliance_documents" gorm:"default:'[]'"`

	// Audit
	CreatedBy  uuid.UUID  `json:"created_by" gorm:"type:uuid;not null"`
	ApprovedBy *uuid.UUID `json:"approved_by" gorm:"type:uuid"`
	ApprovedAt *time.Time `json:"approved_at"`
	CreatedAt  time.Time  `json:"created_at" gorm:"autoCreateTime"`

	// Associations
	Creator  User `json:"creator" gorm:"foreignKey:CreatedBy"`
	Approver *User `json:"approver" gorm:"foreignKey:ApprovedBy"`
}

// DistributionType represents the type of revenue distribution
type DistributionType string

const (
	DistributionTypeCreditSale  DistributionType = "credit_sale"
	DistributionTypeForwardSale DistributionType = "forward_sale"
	DistributionTypeRoyalty     DistributionType = "royalty"
	DistributionTypeRetirement  DistributionType = "retirement"
)

// PaymentStatus represents the status of payment processing
type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "pending"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusCompleted  PaymentStatus = "completed"
	PaymentStatusFailed     PaymentStatus = "failed"
	PaymentStatusPartial    PaymentStatus = "partial"
)

// PaymentTransaction represents all payment processing records across providers
type PaymentTransaction struct {
	ID                   uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ExternalID           *string      `json:"external_id" gorm:"unique;index"`
	UserID               *uuid.UUID   `json:"user_id" gorm:"type:uuid;index"`
	ProjectID            *uuid.UUID   `json:"project_id" gorm:"type:uuid;index"`
	DistributionID       *uuid.UUID   `json:"distribution_id" gorm:"type:uuid;index"`

	// Payment details
	Amount              float64             `json:"amount" gorm:"type:decimal(14,4);not null"`
	Currency            string              `json:"currency" gorm:"not null"`
	PaymentMethod       PaymentMethod       `json:"payment_method" gorm:"not null"`
	PaymentProvider     PaymentProvider     `json:"payment_provider" gorm:"not null;index"`
	GatewayTransactionID *string            `json:"gateway_transaction_id"`

	// Status
	Status         TransactionStatus `json:"status" gorm:"default:'initiated';index"`
	ProviderStatus datatypes.JSON     `json:"provider_status" gorm:"default:'{}'"`
	FailureReason  *string           `json:"failure_reason"`
	FailureCode    *string           `json:"failure_code"`

	// Processing metadata
	ProcessingStartedAt   *time.Time `json:"processing_started_at"`
	ProcessingCompletedAt *time.Time `json:"processing_completed_at"`
	RetryAttempts         int        `json:"retry_attempts" gorm:"default:0"`
	NextRetryAt           *time.Time `json:"next_retry_at"`

	// Blockchain specifics (for Stellar payments)
	StellarTransactionHash *string `json:"stellar_transaction_hash" gorm:"index"`
	StellarAssetCode       *string `json:"stellar_asset_code"`
	StellarAssetIssuer     *string `json:"stellar_asset_issuer"`
	StellarMemo            *string `json:"stellar_memo"`

	// Fees and settlements
	ProcessingFee     float64  `json:"processing_fee" gorm:"type:decimal(12,4);default:0"`
	NetworkFee        float64  `json:"network_fee" gorm:"type:decimal(12,4);default:0"`
	SettlementAmount  *float64 `json:"settlement_amount" gorm:"type:decimal(14,4)"`
	SettlementCurrency *string `json:"settlement_currency"`
	SettledAt         *time.Time `json:"settled_at"`

	// Metadata
	Metadata      datatypes.JSON `json:"metadata" gorm:"default:'{}'"`
	WebhookEvents datatypes.JSON `json:"webhook_events" gorm:"default:'[]'"`

	// Audit
	CreatedBy uuid.UUID `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Associations
	User         *User              `json:"user" gorm:"foreignKey:UserID"`
	Project      *Project           `json:"project" gorm:"foreignKey:ProjectID"`
	Distribution *RevenueDistribution `json:"distribution" gorm:"foreignKey:DistributionID"`
	Creator      User               `json:"creator" gorm:"foreignKey:CreatedBy"`
}

// PaymentMethod represents different payment methods
type PaymentMethod string

const (
	PaymentMethodCreditCard  PaymentMethod = "credit_card"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodStellar     PaymentMethod = "stellar"
	PaymentMethodMpesa       PaymentMethod = "mpesa"
	PaymentMethodPaypal      PaymentMethod = "paypal"
)

// PaymentProvider represents different payment providers
type PaymentProvider string

const (
	PaymentProviderStripe        PaymentProvider = "stripe"
	PaymentProviderPaypal        PaymentProvider = "paypal"
	PaymentProviderStellarNetwork PaymentProvider = "stellar_network"
	PaymentProviderMpesa         PaymentProvider = "mpesa"
)

// TransactionStatus represents the status of payment transactions
type TransactionStatus string

const (
	TransactionStatusInitiated TransactionStatus = "initiated"
	TransactionStatusProcessing TransactionStatus = "processing"
	TransactionStatusCompleted TransactionStatus = "completed"
	TransactionStatusFailed    TransactionStatus = "failed"
	TransactionStatusRefunded  TransactionStatus = "refunded"
	TransactionStatusDisputed  TransactionStatus = "disputed"
)

// CreditPricingModel represents configurable pricing models for carbon credits
type CreditPricingModel struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name             string    `json:"name" gorm:"not null"`
	MethodologyCode  string    `json:"methodology_code" gorm:"not null;index"`
	RegionCode       *string   `json:"region_code" gorm:"index"`
	VintageYear      *int      `json:"vintage_year" gorm:"index"`

	// Pricing factors
	BasePrice         float64       `json:"base_price" gorm:"type:decimal(10,4);not null"` // Base price per ton
	QualityMultiplier datatypes.JSON `json:"quality_multiplier" gorm:"default:'{}'"`      // Factors for data quality, co-benefits
	MarketMultiplier  float64       `json:"market_multiplier" gorm:"type:decimal(6,4);default:1.0"` // Market demand multiplier
	LocationAdjustment datatypes.JSON `json:"location_adjustment" gorm:"default:'{}'"`   // Geographic pricing adjustments
	VintageAdjustment  datatypes.JSON `json:"vintage_adjustment" gorm:"default:'{}'"`     // Age-based adjustments

	// Pricing rules
	MinimumPrice          *float64 `json:"minimum_price" gorm:"type:decimal(10,4)"` // Floor price
	MaximumPrice          *float64 `json:"maximum_price" gorm:"type:decimal(10,4)"` // Ceiling price
	PriceVolatilityFactor float64  `json:"price_volatility_factor" gorm:"type:decimal(5,4);default:0.1"` // Volatility multiplier

	// Validity
	ValidFrom time.Time `json:"valid_from" gorm:"type:date;not null"`
	ValidUntil *time.Time `json:"valid_until"`
	IsActive   bool      `json:"is_active" gorm:"default:true;index"`

	// Audit
	CreatedBy  uuid.UUID  `json:"created_by" gorm:"type:uuid;not null"`
	ApprovedBy *uuid.UUID `json:"approved_by" gorm:"type:uuid"`
	CreatedAt  time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Associations
	Creator  User  `json:"creator" gorm:"foreignKey:CreatedBy"`
	Approver *User `json:"approver" gorm:"foreignKey:ApprovedBy"`
}

// CreditPriceHistory represents historical pricing data and market information
type CreditPriceHistory struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PricingModelID uuid.UUID `json:"pricing_model_id" gorm:"type:uuid;not null;index"`

	// Price data
	MethodologyCode string  `json:"methodology_code" gorm:"not null"`
	RegionCode      *string `json:"region_code"`
	VintageYear     *int    `json:"vintage_year"`
	PricePerTon     float64 `json:"price_per_ton" gorm:"type:decimal(10,4);not null"`
	Currency        string  `json:"currency" gorm:"default:'USD'"`

	// Market context
	MarketSource   *string `json:"market_source"`   // Source of price data
	MarketVolume   *float64 `json:"market_volume" gorm:"type:decimal(14,4)"` // Trading volume
	MarketSentiment *string `json:"market_sentiment"` // 'bullish', 'bearish', 'neutral'

	// Effective period
	EffectiveDate time.Time `json:"effective_date" gorm:"type:date;not null;index"`

	// Audit
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	// Associations
	PricingModel CreditPricingModel `json:"pricing_model" gorm:"foreignKey:PricingModelID"`
}

// TokenMintingWorkflow represents Stellar blockchain token minting workflow tracking
type TokenMintingWorkflow struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreditID     uuid.UUID      `json:"credit_id" gorm:"type:uuid;not null;index"`

	// Workflow configuration
	WorkflowType WorkflowType `json:"workflow_type" gorm:"default:'standard'"`
	Priority     int          `json:"priority" gorm:"default:5"` // 1-10 priority level

	// Stellar contract details
	ContractAddress string        `json:"contract_address" gorm:"not null"` // Soroban contract address
	FunctionName    string        `json:"function_name" gorm:"not null;default:'mint'"`
	FunctionArgs    datatypes.JSON `json:"function_args" gorm:"default:'{}'"`

	// Execution tracking
	Status               WorkflowStatus `json:"status" gorm:"default:'pending';index"`
	StellarTransactionHash *string       `json:"stellar_transaction_hash" gorm:"index"`
	StellarLedgerSequence *int64         `json:"stellar_ledger_sequence"`

	// Timing
	InitiatedAt  time.Time  `json:"initiated_at" gorm:"autoCreateTime"`
	SubmittedAt  *time.Time `json:"submitted_at"`
	ConfirmedAt  *time.Time `json:"confirmed_at"`
	CompletedAt  *time.Time `json:"completed_at"`

	// Error handling
	ErrorCode    *string   `json:"error_code"`
	ErrorMessage *string   `json:"error_message"`
	RetryCount   int       `json:"retry_count" gorm:"default:0"`
	MaxRetries   int       `json:"max_retries" gorm:"default:3"`
	NextRetryAt  *time.Time `json:"next_retry_at"`

	// Gas and fees
	GasUsed        *int64   `json:"gas_used"`
	GasPrice       *float64 `json:"gas_price" gorm:"type:decimal(10,8)"`
	TransactionFee *float64 `json:"transaction_fee" gorm:"type:decimal(14,8)"`

	// Metadata
	Metadata datatypes.JSON `json:"metadata" gorm:"default:'{}'"`

	// Audit
	InitiatedBy uuid.UUID `json:"initiated_by" gorm:"type:uuid;not null"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Associations
	Credit  CarbonCredit `json:"credit" gorm:"foreignKey:CreditID"`
	Initiator User       `json:"initiator" gorm:"foreignKey:InitiatedBy"`
}

// WorkflowType represents different types of minting workflows
type WorkflowType string

const (
	WorkflowTypeStandard WorkflowType = "standard"
	WorkflowTypeBatch    WorkflowType = "batch"
	WorkflowTypeEmergency WorkflowType = "emergency"
)

// WorkflowStatus represents the status of minting workflows
type WorkflowStatus string

const (
	WorkflowStatusPending    WorkflowStatus = "pending"
	WorkflowStatusBuilding   WorkflowStatus = "building"
	WorkflowStatusSubmitted  WorkflowStatus = "submitted"
	WorkflowStatusConfirmed  WorkflowStatus = "confirmed"
	WorkflowStatusFailed     WorkflowStatus = "failed"
	WorkflowStatusCancelled  WorkflowStatus = "cancelled"
)

// CreditAuction represents auction mechanisms for bulk carbon credit sales
type CreditAuction struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProjectID   uuid.UUID    `json:"project_id" gorm:"type:uuid;not null;index"`
	AuctionType AuctionType  `json:"auction_type" gorm:"not null"`

	// Auction parameters
	TotalTons        float64    `json:"total_tons" gorm:"type:decimal(12,4);not null"`
	MinimumPrice     float64    `json:"minimum_price" gorm:"type:decimal(10,4);not null"`
	ReservePrice     *float64   `json:"reserve_price" gorm:"type:decimal(10,4)"`
	StartPrice       *float64   `json:"start_price" gorm:"type:decimal(10,4)"` // For Dutch auctions

	// Timing
	StartTime            time.Time     `json:"start_time" gorm:"not null;index"`
	EndTime              time.Time     `json:"end_time" gorm:"not null"`
	PriceDecrementInterval *time.Duration `json:"price_decrement_interval"` // For Dutch auctions
	PriceDecrementAmount *float64      `json:"price_decrement_amount" gorm:"type:decimal(10,4)"` // For Dutch auctions

	// Status
	Status       AuctionStatus `json:"status" gorm:"default:'upcoming';index"`
	WinningBidID *uuid.UUID    `json:"winning_bid_id" gorm:"type:uuid"`

	// Results
	FinalPrice  *float64 `json:"final_price" gorm:"type:decimal(10,4)"`
	TotalSold   *float64 `json:"total_sold" gorm:"type:decimal(12,4)"`
	TotalRevenue *float64 `json:"total_revenue" gorm:"type:decimal(14,4)"`

	// Audit
	CreatedBy uuid.UUID `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Associations
	Project Project `json:"project" gorm:"foreignKey:ProjectID"`
	Creator User    `json:"creator" gorm:"foreignKey:CreatedBy"`
}

// AuctionType represents different auction mechanisms
type AuctionType string

const (
	AuctionTypeDutch      AuctionType = "dutch"
	AuctionTypeSealedBid  AuctionType = "sealed_bid"
	AuctionTypeEnglish    AuctionType = "english"
)

// AuctionStatus represents the status of auctions
type AuctionStatus string

const (
	AuctionStatusUpcoming  AuctionStatus = "upcoming"
	AuctionStatusActive    AuctionStatus = "active"
	AuctionStatusEnded     AuctionStatus = "ended"
	AuctionStatusCancelled AuctionStatus = "cancelled"
)

// AuctionBid represents individual bids in carbon credit auctions
type AuctionBid struct {
	ID        uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AuctionID uuid.UUID  `json:"auction_id" gorm:"type:uuid;not null;index"`
	BidderID  uuid.UUID  `json:"bidder_id" gorm:"type:uuid;not null;index"`

	// Bid details
	BidAmount  float64 `json:"bid_amount" gorm:"type:decimal(12,4);not null"` // Tons requested
	BidPrice   float64 `json:"bid_price" gorm:"type:decimal(10,4);not null"` // Price per ton
	TotalValue float64 `json:"total_value" gorm:"type:decimal(14,4)"` // Generated from amount * price

	// Bid status
	Status    BidStatus `json:"status" gorm:"default:'active';index"`
	IsWinning bool      `json:"is_winning" gorm:"default:false"`

	// Timing
	PlacedAt time.Time `json:"placed_at" gorm:"autoCreateTime"`

	// Metadata
	Metadata datatypes.JSON `json:"metadata" gorm:"default:'{}'"`

	// Associations
	Auction CreditAuction `json:"auction" gorm:"foreignKey:AuctionID"`
	Bidder  User          `json:"bidder" gorm:"foreignKey:BidderID"`
}

// BidStatus represents the status of auction bids
type BidStatus string

const (
	BidStatusActive    BidStatus = "active"
	BidStatusWinning  BidStatus = "winning"
	BidStatusLosing   BidStatus = "losing"
	BidStatusWithdrawn BidStatus = "withdrawn"
)

// These are placeholder types for foreign key relationships
// In a real implementation, these would be imported from their respective modules
type User struct {
	ID    uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Name  string    `json:"name"`
	Email string    `json:"email"`
}

type Project struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
}

// BeforeCreate hook for UUID generation
func (c *CarbonCredit) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (f *ForwardSaleAgreement) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return nil
}

func (r *RevenueDistribution) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

func (p *PaymentTransaction) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

func (c *CreditPricingModel) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (c *CreditPriceHistory) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (t *TokenMintingWorkflow) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

func (c *CreditAuction) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (a *AuctionBid) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
