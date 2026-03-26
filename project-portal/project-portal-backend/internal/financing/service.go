package financing

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing/calculation"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/payments"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/sales"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/tokenization"
	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Service interface {
	CalculateCredits(ctx context.Context, projectID uuid.UUID, req CalculateCreditsRequest) (*CarbonCredit, error)
	ListProjectCredits(ctx context.Context, projectID uuid.UUID) ([]CarbonCredit, error)
	MintCredits(ctx context.Context, req MintCreditsRequest) (*CarbonCredit, error)
	GetCreditStatus(ctx context.Context, creditID uuid.UUID) (*CreditStatusResponse, error)
	CreateForwardSale(ctx context.Context, req CreateForwardSaleRequest) (*ForwardSaleAgreement, error)
	GetPriceQuote(ctx context.Context, methodologyCode, regionCode string, vintageYear int, dataQuality float64) (*PricingQuoteResponse, error)
	InitiatePayment(ctx context.Context, req InitiatePaymentRequest) (*PaymentTransaction, error)
	DistributeRevenue(ctx context.Context, req DistributeRevenueRequest) (*RevenueDistribution, error)
	GetPayoutStatus(ctx context.Context, payoutID uuid.UUID) (*RevenueDistribution, error)
	GetCreditTraceability(ctx context.Context, tokenID string) (*TraceabilityResponse, error)
	ListCreditsByMethodology(ctx context.Context, projectID uuid.UUID, methodologyID int) ([]CarbonCredit, error)
	HandleStellarWebhook(ctx context.Context, req StellarWebhookRequest) error
	HandlePaymentWebhook(ctx context.Context, req PaymentWebhookRequest) error
}

type service struct {
	repo          Repository
	validator     *calculation.Validator
	calcEngine    *calculation.Engine
	pricingEngine *sales.PricingEngine
	workflow      *tokenization.Workflow
	processor     payments.Processor
	distributor   *payments.Distributor
	methService   methodology.Service
}

func NewService(repo Repository, methService methodology.Service) Service {
	stellarClient := tokenization.NewMockStellarClient()
	monitor := tokenization.NewMonitor()
	return &service{
		repo:          repo,
		validator:     calculation.NewValidator(),
		calcEngine:    calculation.NewEngine(),
		pricingEngine: sales.NewPricingEngine(),
		workflow:      tokenization.NewWorkflow(stellarClient, monitor, methService),
		processor:     payments.NewMockProcessor(),
		distributor:   payments.NewDistributor(),
		methService:   methService,
	}
}

func (s *service) CalculateCredits(ctx context.Context, projectID uuid.UUID, req CalculateCreditsRequest) (*CarbonCredit, error) {
	periodStart, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		return nil, fmt.Errorf("invalid period_start, expected YYYY-MM-DD")
	}
	periodEnd, err := time.Parse("2006-01-02", req.PeriodEnd)
	if err != nil {
		return nil, fmt.Errorf("invalid period_end, expected YYYY-MM-DD")
	}
	normalizedMethodology := calculation.NormalizeMethodology(req.MethodologyCode)
	if err := s.validator.Validate(calculation.ValidationInput{
		MethodologyCode: normalizedMethodology,
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		AreaHectares:    req.AreaHectares,
		DataQuality:     req.DataQuality,
	}); err != nil {
		return nil, err
	}
	result := s.calcEngine.Calculate(calculation.Input{
		MethodologyCode: normalizedMethodology,
		AreaHectares:    req.AreaHectares,
		DataQuality:     req.DataQuality,
		MonitoringData:  req.MonitoringData,
	})

	credit := &CarbonCredit{
		ProjectID:              projectID,
		VintageYear:            req.VintageYear,
		CalculationPeriodStart: periodStart,
		CalculationPeriodEnd:   periodEnd,
		MethodologyCode:        normalizedMethodology,
		CalculatedTons:         result.CalculatedTons,
		BufferedTons:           result.BufferedTons,
		DataQualityScore:       req.DataQuality,
		Status:                 CreditStatusCalculated,
		CalculationInputs: datatypes.JSONMap{
			"monitoring_data": req.MonitoringData,
			"area_hectares":   req.AreaHectares,
			"data_quality":    req.DataQuality,
		},
		CalculationAuditTrail: datatypes.JSONMap(result.AuditTrail),
	}
	if err := s.repo.CreateCredit(ctx, credit); err != nil {
		return nil, err
	}
	return credit, nil
}

func (s *service) ListProjectCredits(ctx context.Context, projectID uuid.UUID) ([]CarbonCredit, error) {
	return s.repo.ListProjectCredits(ctx, projectID)
}

func (s *service) MintCredits(ctx context.Context, req MintCreditsRequest) (*CarbonCredit, error) {
	credit, err := s.repo.GetCredit(ctx, req.CreditID)
	if err != nil {
		return nil, err
	}
	if !isMintableStatus(credit.Status) {
		return nil, fmt.Errorf("credit status %s cannot be minted", credit.Status)
	}
	if req.BatchSize <= 0 {
		req.BatchSize = 1
	}
	credit.Status = CreditStatusMinting
	if err := s.repo.UpdateCredit(ctx, credit); err != nil {
		return nil, err
	}

	assetCode := fmt.Sprintf("CRB%04d", credit.VintageYear%10000)
	outcome, err := s.workflow.Mint(ctx, tokenization.MintInput{
		ProjectID:   credit.ProjectID,
		AssetCode:   assetCode,
		AssetIssuer: req.IssuerAccount,
		Amount:      credit.BufferedTons,
		BatchSize:   req.BatchSize,
	})
	if err != nil {
		credit.Status = CreditStatusVerified
		_ = s.repo.UpdateCredit(ctx, credit)
		return nil, err
	}

	tokenJSON, _ := json.Marshal(outcome.TokenIDs)
	now := time.Now().UTC()
	credit.MintTransactionHash = outcome.TransactionHash
	credit.StellarAssetCode = outcome.AssetCode
	credit.StellarAssetIssuer = outcome.AssetIssuer
	credit.MethodologyTokenID = outcome.MethodologyTokenID
	credit.TokenIDs = datatypes.JSON(tokenJSON)
	credit.IssuedTons = credit.BufferedTons
	credit.MintedAt = &now
	credit.Status = CreditStatusMinted
	if err := s.repo.UpdateCredit(ctx, credit); err != nil {
		return nil, err
	}
	return credit, nil
}

func (s *service) GetCreditTraceability(ctx context.Context, tokenID string) (*TraceabilityResponse, error) {
	credit, err := s.repo.GetCreditByTokenID(ctx, tokenID)
	if err != nil {
		return nil, fmt.Errorf("credit not found for token %s: %w", tokenID, err)
	}

	mintedAt := time.Time{}
	if credit.MintedAt != nil {
		mintedAt = *credit.MintedAt
	}

	return &TraceabilityResponse{
		TokenID:            tokenID,
		ProjectID:          credit.ProjectID,
		MethodologyCode:    credit.MethodologyCode,
		MethodologyTokenID: credit.MethodologyTokenID,
		VintageYear:        credit.VintageYear,
		MintTransaction:    credit.MintTransactionHash,
		MintedAt:           mintedAt,
	}, nil
}

func (s *service) ListCreditsByMethodology(ctx context.Context, projectID uuid.UUID, methodologyID int) ([]CarbonCredit, error) {
	return s.repo.ListCreditsByMethodology(ctx, projectID, methodologyID)
}

func (s *service) GetCreditStatus(ctx context.Context, creditID uuid.UUID) (*CreditStatusResponse, error) {
	credit, err := s.repo.GetCredit(ctx, creditID)
	if err != nil {
		return nil, err
	}
	return &CreditStatusResponse{
		CreditID:            credit.ID,
		Status:              credit.Status,
		MintTransactionHash: credit.MintTransactionHash,
		IssuedTons:          credit.IssuedTons,
		MintedAt:            credit.MintedAt,
		LastUpdatedAt:       credit.UpdatedAt,
	}, nil
}

func (s *service) CreateForwardSale(ctx context.Context, req CreateForwardSaleRequest) (*ForwardSaleAgreement, error) {
	deliveryDate, err := time.Parse("2006-01-02", req.DeliveryDate)
	if err != nil {
		return nil, fmt.Errorf("invalid delivery_date, expected YYYY-MM-DD")
	}
	totalAmount := req.TonsCommitted * req.PricePerTon
	now := time.Now().UTC()
	agreement := &ForwardSaleAgreement{
		ProjectID:            req.ProjectID,
		BuyerID:              req.BuyerID,
		VintageYear:          req.VintageYear,
		TonsCommitted:        req.TonsCommitted,
		PricePerTon:          req.PricePerTon,
		Currency:             normalizeCurrency(req.Currency),
		TotalAmount:          totalAmount,
		DeliveryDate:         deliveryDate,
		DepositPercent:       req.DepositPercent,
		DepositPaid:          req.DepositPaid,
		DepositTransactionID: req.DepositExternalID,
		PaymentSchedule:      req.PaymentSchedule,
		ContractHash:         strings.TrimSpace(req.ContractHash),
		Status:               ForwardSaleStatusPending,
	}
	if req.SignedByBuyer {
		agreement.SignedByBuyerAt = &now
	}
	if req.SignedBySeller {
		agreement.SignedBySellerAt = &now
	}
	if agreement.SignedByBuyerAt != nil && agreement.SignedBySellerAt != nil {
		agreement.Status = ForwardSaleStatusActive
	}
	if err := s.repo.CreateForwardSale(ctx, agreement); err != nil {
		return nil, err
	}
	return agreement, nil
}

func (s *service) GetPriceQuote(ctx context.Context, methodologyCode, regionCode string, vintageYear int, dataQuality float64) (*PricingQuoteResponse, error) {
	normalizedMethodology := calculation.NormalizeMethodology(methodologyCode)
	model, err := s.repo.GetActivePricingModel(ctx, normalizedMethodology, strings.ToUpper(strings.TrimSpace(regionCode)), vintageYear)
	if err != nil {
		return nil, err
	}
	pricingModel := sales.PricingModel{
		BasePrice:         12.5,
		MarketMultiplier:  1.0,
		QualityMultiplier: map[string]float64{},
	}
	if model != nil {
		pricingModel.BasePrice = model.BasePrice
		pricingModel.MarketMultiplier = model.MarketMultiplier
		for k, v := range model.QualityMultiplier {
			floatVal, ok := v.(float64)
			if ok {
				pricingModel.QualityMultiplier[k] = floatVal
			}
		}
	}
	quote := s.pricingEngine.Quote(pricingModel, sales.QuoteInput{
		MethodologyCode: normalizedMethodology,
		RegionCode:      strings.ToUpper(strings.TrimSpace(regionCode)),
		VintageYear:     vintageYear,
		DataQuality:     dataQuality,
	})
	return &PricingQuoteResponse{
		MethodologyCode:  normalizedMethodology,
		RegionCode:       strings.ToUpper(strings.TrimSpace(regionCode)),
		VintageYear:      vintageYear,
		PricePerTon:      quote.PricePerTon,
		Currency:         "USD",
		MarketMultiplier: quote.MarketMultiplier,
		QualityFactor:    quote.QualityFactor,
	}, nil
}

func (s *service) InitiatePayment(ctx context.Context, req InitiatePaymentRequest) (*PaymentTransaction, error) {
	resp, err := s.processor.Initiate(ctx, payments.InitiationRequest{
		Amount:          req.Amount,
		Currency:        req.Currency,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: req.PaymentProvider,
	})
	if err != nil {
		return nil, err
	}
	payment := &PaymentTransaction{
		ExternalID:      resp.ExternalID,
		UserID:          req.UserID,
		ProjectID:       req.ProjectID,
		Amount:          req.Amount,
		Currency:        req.Currency,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: req.PaymentProvider,
		Status:          resp.Status,
		ProviderStatus:  datatypes.JSONMap(resp.Raw),
		Metadata:        req.Metadata,
	}
	if payments.IsStellarProvider(req.PaymentProvider) {
		payment.StellarAssetCode = payments.NormalizeAssetCode(req.Currency)
	}
	if err := s.repo.CreatePaymentTransaction(ctx, payment); err != nil {
		return nil, err
	}
	return payment, nil
}

func (s *service) DistributeRevenue(ctx context.Context, req DistributeRevenueRequest) (*RevenueDistribution, error) {
	beneficiaries := make([]payments.Beneficiary, 0, len(req.Beneficiaries))
	for _, b := range req.Beneficiaries {
		beneficiaries = append(beneficiaries, payments.Beneficiary{
			UserID:      b.UserID,
			Percent:     b.Percent,
			TaxWithheld: b.TaxWithheld,
		})
	}
	computed, err := s.distributor.Compute(payments.DistributionInput{
		TotalReceived:      req.TotalReceived,
		PlatformFeePercent: req.PlatformFeePercent,
		Beneficiaries:      beneficiaries,
	})
	if err != nil {
		return nil, err
	}
	serializedBeneficiaries, err := json.Marshal(computed.Beneficiaries)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	payout := &RevenueDistribution{
		CreditSaleID:       req.CreditSaleID,
		DistributionType:   req.DistributionType,
		TotalReceived:      req.TotalReceived,
		Currency:           req.Currency,
		PlatformFeePercent: req.PlatformFeePercent,
		PlatformFeeAmount:  computed.PlatformFeeAmount,
		NetAmount:          computed.NetAmount,
		Beneficiaries:      datatypes.JSON(serializedBeneficiaries),
		PaymentBatchID:     req.PaymentBatchID,
		PaymentStatus:      "completed",
		PaymentProcessedAt: &now,
	}
	if err := s.repo.CreateRevenueDistribution(ctx, payout); err != nil {
		return nil, err
	}
	return payout, nil
}

func (s *service) GetPayoutStatus(ctx context.Context, payoutID uuid.UUID) (*RevenueDistribution, error) {
	return s.repo.GetRevenueDistribution(ctx, payoutID)
}

func (s *service) HandleStellarWebhook(ctx context.Context, req StellarWebhookRequest) error {
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if req.CreditID == "" {
		return nil
	}
	creditID, err := uuid.Parse(req.CreditID)
	if err != nil {
		return fmt.Errorf("invalid credit_id in webhook")
	}
	credit, err := s.repo.GetCredit(ctx, creditID)
	if err != nil {
		return err
	}
	credit.MintTransactionHash = req.TransactionHash
	switch status {
	case "confirmed", "success", "minted":
		now := time.Now().UTC()
		credit.Status = CreditStatusMinted
		if credit.IssuedTons == 0 {
			credit.IssuedTons = credit.BufferedTons
		}
		credit.MintedAt = &now
	case "failed", "error":
		credit.Status = CreditStatusVerified
	}
	return s.repo.UpdateCredit(ctx, credit)
}

func (s *service) HandlePaymentWebhook(ctx context.Context, req PaymentWebhookRequest) error {
	payment, err := s.repo.FindPaymentByExternalID(ctx, req.ExternalID)
	if err != nil {
		return err
	}
	payment.Status = strings.ToLower(strings.TrimSpace(req.Status))
	if payment.ProviderStatus == nil {
		payment.ProviderStatus = datatypes.JSONMap{}
	}
	payment.ProviderStatus["provider"] = req.Provider
	payment.ProviderStatus["webhook_status"] = req.Status
	payment.ProviderStatus["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(req.Reason) != "" {
		payment.FailureReason = req.Reason
	}
	return s.repo.UpdatePaymentTransaction(ctx, payment)
}
