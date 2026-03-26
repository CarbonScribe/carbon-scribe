package financing

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type CarbonCredit struct {
	ID                     uuid.UUID         `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProjectID              uuid.UUID         `json:"project_id" gorm:"type:uuid;index;not null"`
	VintageYear            int               `json:"vintage_year" gorm:"not null"`
	CalculationPeriodStart time.Time         `json:"calculation_period_start" gorm:"type:date;not null"`
	CalculationPeriodEnd   time.Time         `json:"calculation_period_end" gorm:"type:date;not null"`
	MethodologyCode        string            `json:"methodology_code" gorm:"size:50;not null;index"`
	MethodologyTokenID     int               `json:"methodology_token_id" gorm:"column:methodology_token_id"`
	CalculatedTons         float64           `json:"calculated_tons" gorm:"type:numeric(12,4);not null"`
	BufferedTons           float64           `json:"buffered_tons" gorm:"type:numeric(12,4);not null"`
	IssuedTons             float64           `json:"issued_tons" gorm:"type:numeric(12,4)"`
	DataQualityScore       float64           `json:"data_quality_score" gorm:"type:numeric(3,2)"`
	CalculationInputs      datatypes.JSONMap `json:"calculation_inputs" gorm:"type:jsonb;default:'{}'"`
	CalculationAuditTrail  datatypes.JSONMap `json:"calculation_audit_trail" gorm:"type:jsonb;default:'{}'"`
	StellarAssetCode       string            `json:"stellar_asset_code" gorm:"size:12"`
	StellarAssetIssuer     string            `json:"stellar_asset_issuer" gorm:"size:56"`
	TokenIDs               datatypes.JSON    `json:"token_ids" gorm:"type:jsonb;default:'[]'"`
	MintTransactionHash    string            `json:"mint_transaction_hash" gorm:"size:128"`
	MintedAt               *time.Time        `json:"minted_at"`
	Status                 string            `json:"status" gorm:"size:50;default:'calculated';index"`
	VerificationID         *uuid.UUID        `json:"verification_id" gorm:"type:uuid"`
	CreatedAt              time.Time         `json:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at"`
}

func (c *CarbonCredit) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.Status == "" {
		c.Status = CreditStatusCalculated
	}
	if c.CalculationInputs == nil {
		c.CalculationInputs = datatypes.JSONMap{}
	}
	if c.CalculationAuditTrail == nil {
		c.CalculationAuditTrail = datatypes.JSONMap{}
	}
	if len(c.TokenIDs) == 0 {
		c.TokenIDs = datatypes.JSON([]byte("[]"))
	}
	return nil
}

type ForwardSaleAgreement struct {
	ID                   uuid.UUID         `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProjectID            uuid.UUID         `json:"project_id" gorm:"type:uuid;index;not null"`
	BuyerID              uuid.UUID         `json:"buyer_id" gorm:"type:uuid;index;not null"`
	VintageYear          int               `json:"vintage_year" gorm:"not null"`
	TonsCommitted        float64           `json:"tons_committed" gorm:"type:numeric(12,4);not null"`
	PricePerTon          float64           `json:"price_per_ton" gorm:"type:numeric(10,4);not null"`
	Currency             string            `json:"currency" gorm:"size:3;default:'USD'"`
	TotalAmount          float64           `json:"total_amount" gorm:"type:numeric(14,4);not null"`
	DeliveryDate         time.Time         `json:"delivery_date" gorm:"type:date;not null"`
	DepositPercent       float64           `json:"deposit_percent" gorm:"type:numeric(5,2);not null"`
	DepositPaid          bool              `json:"deposit_paid"`
	DepositTransactionID string            `json:"deposit_transaction_id" gorm:"size:100"`
	PaymentSchedule      datatypes.JSONMap `json:"payment_schedule" gorm:"type:jsonb;default:'{}'"`
	ContractHash         string            `json:"contract_hash" gorm:"size:64"`
	SignedBySellerAt     *time.Time        `json:"signed_by_seller_at"`
	SignedByBuyerAt      *time.Time        `json:"signed_by_buyer_at"`
	Status               string            `json:"status" gorm:"size:50;default:'pending'"`
	CreatedAt            time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at"`
}

func (f *ForwardSaleAgreement) BeforeCreate(tx *gorm.DB) (err error) {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	f.Currency = normalizeCurrency(f.Currency)
	if f.Status == "" {
		f.Status = ForwardSaleStatusPending
	}
	if f.PaymentSchedule == nil {
		f.PaymentSchedule = datatypes.JSONMap{}
	}
	return nil
}

type RevenueDistribution struct {
	ID                 uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CreditSaleID       uuid.UUID      `json:"credit_sale_id" gorm:"type:uuid;index;not null"`
	DistributionType   string         `json:"distribution_type" gorm:"size:50;not null"`
	TotalReceived      float64        `json:"total_received" gorm:"type:numeric(14,4);not null"`
	Currency           string         `json:"currency" gorm:"size:3;not null"`
	PlatformFeePercent float64        `json:"platform_fee_percent" gorm:"type:numeric(5,2);not null"`
	PlatformFeeAmount  float64        `json:"platform_fee_amount" gorm:"type:numeric(12,4);not null"`
	NetAmount          float64        `json:"net_amount" gorm:"type:numeric(14,4);not null"`
	Beneficiaries      datatypes.JSON `json:"beneficiaries" gorm:"type:jsonb;not null"`
	PaymentBatchID     string         `json:"payment_batch_id" gorm:"size:100"`
	PaymentStatus      string         `json:"payment_status" gorm:"size:50;default:'pending'"`
	PaymentProcessedAt *time.Time     `json:"payment_processed_at"`
	CreatedAt          time.Time      `json:"created_at"`
}

func (r *RevenueDistribution) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	r.Currency = normalizeCurrency(r.Currency)
	if r.PaymentStatus == "" {
		r.PaymentStatus = "pending"
	}
	if len(r.Beneficiaries) == 0 {
		r.Beneficiaries = datatypes.JSON([]byte("[]"))
	}
	return nil
}

type PaymentTransaction struct {
	ID                     uuid.UUID         `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ExternalID             string            `json:"external_id" gorm:"size:100;uniqueIndex"`
	UserID                 *uuid.UUID        `json:"user_id" gorm:"type:uuid;index"`
	ProjectID              *uuid.UUID        `json:"project_id" gorm:"type:uuid;index"`
	Amount                 float64           `json:"amount" gorm:"type:numeric(14,4);not null"`
	Currency               string            `json:"currency" gorm:"size:3;not null"`
	PaymentMethod          string            `json:"payment_method" gorm:"size:50;not null"`
	PaymentProvider        string            `json:"payment_provider" gorm:"size:50;not null"`
	Status                 string            `json:"status" gorm:"size:50;default:'initiated'"`
	ProviderStatus         datatypes.JSONMap `json:"provider_status" gorm:"type:jsonb;default:'{}'"`
	FailureReason          string            `json:"failure_reason"`
	StellarTransactionHash string            `json:"stellar_transaction_hash" gorm:"size:128"`
	StellarAssetCode       string            `json:"stellar_asset_code" gorm:"size:12"`
	StellarAssetIssuer     string            `json:"stellar_asset_issuer" gorm:"size:56"`
	Metadata               datatypes.JSONMap `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt              time.Time         `json:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at"`
}

func (p *PaymentTransaction) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	p.Currency = normalizeCurrency(p.Currency)
	if p.Status == "" {
		p.Status = "initiated"
	}
	if p.ProviderStatus == nil {
		p.ProviderStatus = datatypes.JSONMap{}
	}
	if p.Metadata == nil {
		p.Metadata = datatypes.JSONMap{}
	}
	return nil
}

type CreditPricingModel struct {
	ID                uuid.UUID         `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	MethodologyCode   string            `json:"methodology_code" gorm:"size:50;index;not null"`
	RegionCode        string            `json:"region_code" gorm:"size:10;index"`
	VintageYear       *int              `json:"vintage_year" gorm:"index"`
	BasePrice         float64           `json:"base_price" gorm:"type:numeric(10,4);not null"`
	QualityMultiplier datatypes.JSONMap `json:"quality_multiplier" gorm:"type:jsonb;default:'{}'"`
	MarketMultiplier  float64           `json:"market_multiplier" gorm:"type:numeric(6,4);default:1.0"`
	ValidFrom         time.Time         `json:"valid_from" gorm:"type:date;not null"`
	ValidUntil        *time.Time        `json:"valid_until" gorm:"type:date"`
	IsActive          bool              `json:"is_active" gorm:"default:true;index"`
	CreatedAt         time.Time         `json:"created_at"`
}

func (c *CreditPricingModel) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.MarketMultiplier <= 0 {
		c.MarketMultiplier = 1.0
	}
	if c.QualityMultiplier == nil {
		c.QualityMultiplier = datatypes.JSONMap{}
	}
	return nil
}

type CalculateCreditsRequest struct {
	MethodologyCode string             `json:"methodology_code" binding:"required"`
	VintageYear     int                `json:"vintage_year" binding:"required"`
	PeriodStart     string             `json:"period_start" binding:"required"`
	PeriodEnd       string             `json:"period_end" binding:"required"`
	AreaHectares    float64            `json:"area_hectares" binding:"required,gt=0"`
	MonitoringData  map[string]float64 `json:"monitoring_data"`
	DataQuality     float64            `json:"data_quality" binding:"required,gte=0,lte=1"`
}

type MintCreditsRequest struct {
	CreditID      uuid.UUID `json:"credit_id" binding:"required"`
	BatchSize     int       `json:"batch_size"`
	IssuerAccount string    `json:"issuer_account"`
}

type TraceabilityResponse struct {
	TokenID            string    `json:"token_id"`
	ProjectID          uuid.UUID `json:"project_id"`
	MethodologyCode    string    `json:"methodology_code"`
	MethodologyTokenID int       `json:"methodology_token_id"`
	VintageYear        int       `json:"vintage_year"`
	MintTransaction    string    `json:"mint_transaction"`
	MintedAt           time.Time `json:"minted_at"`
}

type CreateForwardSaleRequest struct {
	ProjectID         uuid.UUID         `json:"project_id" binding:"required"`
	BuyerID           uuid.UUID         `json:"buyer_id" binding:"required"`
	VintageYear       int               `json:"vintage_year" binding:"required"`
	TonsCommitted     float64           `json:"tons_committed" binding:"required,gt=0"`
	PricePerTon       float64           `json:"price_per_ton" binding:"required,gt=0"`
	Currency          string            `json:"currency"`
	DeliveryDate      string            `json:"delivery_date" binding:"required"`
	DepositPercent    float64           `json:"deposit_percent" binding:"required,gte=0,lte=100"`
	PaymentSchedule   datatypes.JSONMap `json:"payment_schedule"`
	ContractHash      string            `json:"contract_hash"`
	SignedBySeller    bool              `json:"signed_by_seller"`
	SignedByBuyer     bool              `json:"signed_by_buyer"`
	DepositPaid       bool              `json:"deposit_paid"`
	DepositExternalID string            `json:"deposit_external_id"`
}

type InitiatePaymentRequest struct {
	UserID          *uuid.UUID        `json:"user_id"`
	ProjectID       *uuid.UUID        `json:"project_id"`
	Amount          float64           `json:"amount" binding:"required,gt=0"`
	Currency        string            `json:"currency" binding:"required"`
	PaymentMethod   string            `json:"payment_method" binding:"required"`
	PaymentProvider string            `json:"payment_provider" binding:"required"`
	Metadata        datatypes.JSONMap `json:"metadata"`
}

type BeneficiarySplit struct {
	UserID       uuid.UUID `json:"user_id"`
	Percent      float64   `json:"percent"`
	Amount       float64   `json:"amount"`
	TaxWithheld  float64   `json:"tax_withheld"`
	PaymentRoute string    `json:"payment_route"`
}

type DistributeRevenueRequest struct {
	CreditSaleID       uuid.UUID          `json:"credit_sale_id" binding:"required"`
	DistributionType   string             `json:"distribution_type" binding:"required"`
	TotalReceived      float64            `json:"total_received" binding:"required,gt=0"`
	Currency           string             `json:"currency" binding:"required"`
	PlatformFeePercent float64            `json:"platform_fee_percent" binding:"gte=0,lte=100"`
	Beneficiaries      []BeneficiarySplit `json:"beneficiaries" binding:"required,min=1"`
	PaymentBatchID     string             `json:"payment_batch_id"`
}

type PricingQuoteResponse struct {
	MethodologyCode  string  `json:"methodology_code"`
	RegionCode       string  `json:"region_code"`
	VintageYear      int     `json:"vintage_year"`
	PricePerTon      float64 `json:"price_per_ton"`
	Currency         string  `json:"currency"`
	MarketMultiplier float64 `json:"market_multiplier"`
	QualityFactor    float64 `json:"quality_factor"`
}

type CreditStatusResponse struct {
	CreditID            uuid.UUID  `json:"credit_id"`
	Status              string     `json:"status"`
	MintTransactionHash string     `json:"mint_transaction_hash,omitempty"`
	IssuedTons          float64    `json:"issued_tons"`
	MintedAt            *time.Time `json:"minted_at,omitempty"`
	LastUpdatedAt       time.Time  `json:"last_updated_at"`
}

type StellarWebhookRequest struct {
	TransactionHash string `json:"transaction_hash" binding:"required"`
	CreditID        string `json:"credit_id"`
	Status          string `json:"status" binding:"required"`
	Error           string `json:"error"`
}

type PaymentWebhookRequest struct {
	ExternalID string `json:"external_id" binding:"required"`
	Status     string `json:"status" binding:"required"`
	Provider   string `json:"provider"`
	Reason     string `json:"reason"`
}
