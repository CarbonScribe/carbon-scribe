package sales

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// CreditPricingModel represents pricing model for carbon credits
type CreditPricingModel struct {
	ID                uuid.UUID         `json:"id" db:"id"`
	MethodologyCode   string            `json:"methodology_code" db:"methodology_code"`
	RegionCode        *string           `json:"region_code" db:"region_code"`
	VintageYear       *int              `json:"vintage_year" db:"vintage_year"`
	BasePrice         float64           `json:"base_price" db:"base_price"`
	QualityMultiplier QualityMultiplier `json:"quality_multiplier" db:"quality_multiplier"`
	MarketMultiplier  float64           `json:"market_multiplier" db:"market_multiplier"`
	ValidFrom         time.Time         `json:"valid_from" db:"valid_from"`
	ValidUntil        *time.Time        `json:"valid_until" db:"valid_until"`
	IsActive          bool              `json:"is_active" db:"is_active"`
	CreatedAt         time.Time         `json:"created_at" db:"created_at"`
}

// PricingEngine handles dynamic pricing for carbon credits
type PricingEngine struct {
	repository    PricingRepository
	marketData    *MarketDataProvider
	priceOracles  []PriceOracle
	config        *PricingConfig
}

// PricingRepository defines the interface for pricing data access
type PricingRepository interface {
	GetPricingModel(ctx context.Context, methodologyCode string, regionCode string, vintageYear int) (*CreditPricingModel, error)
	CreatePricingModel(ctx context.Context, model *CreditPricingModel) error
	UpdatePricingModel(ctx context.Context, model *CreditPricingModel) error
	ListPricingModels(ctx context.Context, filters *PricingModelFilters) ([]*CreditPricingModel, error)
	GetHistoricalPrices(ctx context.Context, methodologyCode string, regionCode string, startDate, endDate time.Time) ([]*HistoricalPrice, error)
}

// PricingModelFilters represents filters for pricing models
type PricingModelFilters struct {
	MethodologyCode *string    `json:"methodology_code,omitempty"`
	RegionCode      *string    `json:"region_code,omitempty"`
	VintageYear     *int       `json:"vintage_year,omitempty"`
	IsActive        *bool      `json:"is_active,omitempty"`
	ValidAfter      *time.Time `json:"valid_after,omitempty"`
	ValidBefore     *time.Time `json:"valid_before,omitempty"`
}

// HistoricalPrice represents historical price data
type HistoricalPrice struct {
	Date         time.Time `json:"date"`
	Methodology  string    `json:"methodology"`
	Region       string    `json:"region"`
	Vintage      int       `json:"vintage"`
	Price        float64   `json:"price"`
	Volume       float64   `json:"volume"`
	Source       string    `json:"source"`
}

// MarketDataProvider provides market data
type MarketDataProvider struct {
	sources []MarketDataSource
}

// MarketDataSource defines interface for market data sources
type MarketDataSource interface {
	GetCurrentPrice(ctx context.Context, methodology string, region string) (float64, error)
	GetHistoricalPrices(ctx context.Context, methodology string, region string, startDate, endDate time.Time) ([]*HistoricalPrice, error)
	GetMarketSentiment(ctx context.Context) (MarketSentiment, error)
}

// MarketSentiment represents market sentiment
type MarketSentiment struct {
	Score        float64 `json:"score"`        // -1 to 1
	Trend        string  `json:"trend"`        // "bullish", "bearish", "neutral"
	Volatility   float64 `json:"volatility"`   // 0 to 1
	Liquidity    float64 `json:"liquidity"`    // 0 to 1
	Description  string  `json:"description"`
}

// PriceOracle provides external price feeds
type PriceOracle interface {
	GetPrice(ctx context.Context, request *PriceRequest) (*PriceResponse, error)
	GetName() string
	GetReliability() float64
}

// PriceRequest represents a price request to oracle
type PriceRequest struct {
	MethodologyCode string  `json:"methodology_code"`
	RegionCode      string  `json:"region_code"`
	VintageYear     int     `json:"vintage_year"`
	Tons            float64 `json:"tons"`
	Quality         float64 `json:"quality"`
}

// PriceResponse represents a price response from oracle
type PriceResponse struct {
	Price          float64 `json:"price"`
	Currency       string  `json:"currency"`
	Confidence     float64 `json:"confidence"`
	Source         string  `json:"source"`
	Timestamp      time.Time `json:"timestamp"`
	ValidUntil     time.Time `json:"valid_until"`
}

// PricingConfig holds configuration for pricing engine
type PricingConfig struct {
	DefaultBasePrice      float64 `json:"default_base_price"`
	PriceVarianceLimit    float64 `json:"price_variance_limit"`
	MinPrice              float64 `json:"min_price"`
	MaxPrice              float64 `json:"max_price"`
	QualityWeight         float64 `json:"quality_weight"`
	VintageWeight         float64 `json:"vintage_weight"`
	RegionWeight          float64 `json:"region_weight"`
	MarketWeight          float64 `json:"market_weight"`
	OracleWeight          float64 `json:"oracle_weight"`
	PriceUpdateInterval   time.Duration `json:"price_update_interval"`
}

// PricingFactors represents factors that influence pricing
type PricingFactors struct {
	QualityMultiplier    float64            `json:"quality_multiplier"`
	VintageMultiplier    float64            `json:"vintage_multiplier"`
	RegionMultiplier     float64            `json:"region_multiplier"`
	MarketMultiplier     float64            `json:"market_multiplier"`
	CoBenefits           map[string]float64 `json:"co_benefits"`
	Additionality        float64            `json:"additionality"`
	Permanence          float64            `json:"permanence"`
	Leakage             float64            `json:"leakage"`
}

// NewPricingEngine creates a new pricing engine
func NewPricingEngine(repository PricingRepository, config *PricingConfig) *PricingEngine {
	if config == nil {
		config = &PricingConfig{
			DefaultBasePrice:    15.0, // $15 per ton
			PriceVarianceLimit:  0.30, // 30% variance
			MinPrice:           5.0,
			MaxPrice:           100.0,
			QualityWeight:      0.25,
			VintageWeight:      0.20,
			RegionWeight:       0.15,
			MarketWeight:       0.25,
			OracleWeight:       0.15,
			PriceUpdateInterval: 1 * time.Hour,
		}
	}
	
	engine := &PricingEngine{
		repository:   repository,
		marketData:   NewMarketDataProvider(),
		priceOracles: []PriceOracle{
			NewCMEOOracle(),
			NewCarbonCreditsOracle(),
			NewVerraOracle(),
		},
		config: config,
	}
	
	return engine
}

// GetPriceQuote generates a price quote for carbon credits
func (pe *PricingEngine) GetPriceQuote(ctx context.Context, req *PricingQuoteRequest) (*PricingQuoteResponse, error) {
	// Get pricing model
	model, err := pe.repository.GetPricingModel(ctx, req.MethodologyCode, req.RegionCode, req.VintageYear)
	if err != nil {
		// Create default model if not found
		model = pe.createDefaultPricingModel(req.MethodologyCode, req.RegionCode, req.VintageYear)
	}
	
	// Calculate pricing factors
	factors, err := pe.calculatePricingFactors(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate pricing factors: %w", err)
	}
	
	// Calculate base price
	basePrice := model.BasePrice
	
	// Apply multipliers
	adjustedPrice := pe.applyMultipliers(basePrice, factors, req)
	
	// Apply market conditions
	marketPrice, err := pe.applyMarketConditions(ctx, adjustedPrice, req)
	if err != nil {
		return nil, fmt.Errorf("failed to apply market conditions: %w", err)
	}
	
	// Apply oracle prices
	oraclePrice, err := pe.applyOraclePrices(ctx, marketPrice, req)
	if err != nil {
		return nil, fmt.Errorf("failed to apply oracle prices: %w", err)
	}
	
	// Apply price limits
	finalPrice := pe.applyPriceLimits(oraclePrice)
	
	// Calculate total price
	totalPrice := finalPrice * req.Tons
	
	// Generate pricing factors list
	pricingFactors := pe.generatePricingFactorsList(factors)
	
	// Get market conditions description
	marketConditions, _ := pe.marketData.sources[0].GetMarketSentiment(ctx)
	
	return &PricingQuoteResponse{
		BasePrice:        basePrice,
		AdjustedPrice:    finalPrice,
		TotalPrice:       totalPrice,
		Currency:         "USD",
		ValidUntil:       time.Now().Add(1 * time.Hour),
		PricingFactors:   pricingFactors,
		MarketConditions: marketConditions.Description,
	}, nil
}

// UpdatePricingModel updates or creates a pricing model
func (pe *PricingEngine) UpdatePricingModel(ctx context.Context, model *CreditPricingModel) error {
	// Validate model
	if err := pe.validatePricingModel(model); err != nil {
		return fmt.Errorf("invalid pricing model: %w", err)
	}
	
	// Check if model exists
	existing, err := pe.repository.GetPricingModel(ctx, model.MethodologyCode, model.RegionCode, model.VintageYear)
	if err != nil {
		// Create new model
		model.ID = uuid.New()
		model.CreatedAt = time.Now()
		return pe.repository.CreatePricingModel(ctx, model)
	}
	
	// Update existing model
	model.ID = existing.ID
	model.CreatedAt = existing.CreatedAt
	return pe.repository.UpdatePricingModel(ctx, model)
}

// calculatePricingFactors calculates pricing factors for a request
func (pe *PricingEngine) calculatePricingFactors(ctx context.Context, req *PricingQuoteRequest) (*PricingFactors, error) {
	factors := &PricingFactors{
		CoBenefits: make(map[string]float64),
	}
	
	// Quality multiplier
	factors.QualityMultiplier = pe.calculateQualityMultiplier(req.QualityFactors)
	
	// Vintage multiplier
	factors.VintageMultiplier = pe.calculateVintageMultiplier(req.VintageYear)
	
	// Region multiplier
	factors.RegionMultiplier = pe.calculateRegionMultiplier(req.RegionCode)
	
	// Market multiplier
	marketSentiment, err := pe.marketData.sources[0].GetMarketSentiment(ctx)
	if err == nil {
		factors.MarketMultiplier = pe.calculateMarketMultiplier(marketSentiment)
	} else {
		factors.MarketMultiplier = 1.0
	}
	
	// Co-benefits (simplified)
	factors.CoBenefits["biodiversity"] = 1.05
	factors.CoBenefits["community"] = 1.03
	factors.CoBenefits["water"] = 1.02
	
	// Additionality, permanence, leakage (simplified)
	factors.Additionality = 1.0
	factors.Permanence = 1.0
	factors.Leakage = 1.0
	
	return factors, nil
}

// calculateQualityMultiplier calculates quality-based multiplier
func (pe *PricingEngine) calculateQualityMultiplier(qFactors QualityMultiplier) float64 {
	if qFactors == nil {
		return 1.0
	}
	
	multiplier := 1.0
	
	// Data quality
	if dataQuality, exists := qFactors["data_quality"]; exists {
		multiplier *= (0.8 + 0.4*dataQuality) // 0.8 to 1.2
	}
	
	// Third-party verification
	if verification, exists := qFactors["verification"]; exists {
		if verification > 0.8 {
			multiplier *= 1.1
		}
	}
	
	// Monitoring frequency
	if monitoring, exists := qFactors["monitoring"]; exists {
		multiplier *= (0.9 + 0.2*monitoring) // 0.9 to 1.1
	}
	
	return math.Max(0.5, math.Min(1.5, multiplier))
}

// calculateVintageMultiplier calculates vintage-based multiplier
func (pe *PricingEngine) calculateVintageMultiplier(vintageYear int) float64 {
	currentYear := time.Now().Year()
	age := currentYear - vintageYear
	
	// Newer vintages generally get higher prices
	switch {
	case age <= 0: // Future vintage
		return 1.1
	case age == 1: // Last year
		return 1.05
	case age == 2: // 2 years old
		return 1.0
	case age <= 5: // 3-5 years old
		return 0.95
	case age <= 10: // 6-10 years old
		return 0.9
	default: // Older than 10 years
		return 0.85
	}
}

// calculateRegionMultiplier calculates region-based multiplier
func (pe *PricingEngine) calculateRegionMultiplier(regionCode string) float64 {
	// Region-based pricing adjustments
	regionMultipliers := map[string]float64{
		"AF": 0.9,  // Africa - lower prices
		"AS": 1.0,  // Asia
		"EU": 1.2,  // Europe - higher prices
		"LA": 0.95, // Latin America
		"NA": 1.1,  // North America
		"OC": 1.05, // Oceania
	}
	
	if multiplier, exists := regionMultipliers[regionCode]; exists {
		return multiplier
	}
	
	return 1.0 // Default
}

// calculateMarketMultiplier calculates market-based multiplier
func (pe *PricingEngine) calculateMarketMultiplier(sentiment MarketSentiment) float64 {
	multiplier := 1.0
	
	// Apply sentiment score
	multiplier *= (1.0 + sentiment.Score*0.2) // +/- 20%
	
	// Adjust for volatility
	if sentiment.Volatility > 0.7 {
		multiplier *= 0.95 // High volatility reduces price
	}
	
	// Adjust for liquidity
	if sentiment.Liquidity < 0.3 {
		multiplier *= 0.9 // Low liquidity reduces price
	}
	
	return math.Max(0.7, math.Min(1.3, multiplier))
}

// applyMultipliers applies all multipliers to base price
func (pe *PricingEngine) applyMultipliers(basePrice float64, factors *PricingFactors, req *PricingQuoteRequest) float64 {
	adjustedPrice := basePrice
	
	// Apply quality multiplier
	adjustedPrice *= factors.QualityMultiplier * pe.config.QualityWeight + (1-pe.config.QualityWeight)
	
	// Apply vintage multiplier
	adjustedPrice *= factors.VintageMultiplier * pe.config.VintageWeight + (1-pe.config.VintageWeight)
	
	// Apply region multiplier
	adjustedPrice *= factors.RegionMultiplier * pe.config.RegionWeight + (1-pe.config.RegionWeight)
	
	// Apply market multiplier
	adjustedPrice *= factors.MarketMultiplier * pe.config.MarketWeight + (1-pe.config.MarketWeight)
	
	// Apply co-benefits
	coBenefitMultiplier := 1.0
	for _, value := range factors.CoBenefits {
		coBenefitMultiplier *= value
	}
	coBenefitMultiplier = math.Pow(coBenefitMultiplier, 0.1) // Reduce impact
	adjustedPrice *= coBenefitMultiplier
	
	return adjustedPrice
}

// applyMarketConditions applies current market conditions
func (pe *PricingEngine) applyMarketConditions(ctx context.Context, price float64, req *PricingQuoteRequest) (float64, error) {
	// Get current market price
	marketPrice, err := pe.marketData.sources[0].GetCurrentPrice(ctx, req.MethodologyCode, req.RegionCode)
	if err != nil {
		return price, nil // Use input price if market data unavailable
	}
	
	// Blend with market price
	weight := pe.config.MarketWeight
	blendedPrice := price*(1-weight) + marketPrice*weight
	
	return blendedPrice, nil
}

// applyOraclePrices applies oracle price feeds
func (pe *PricingEngine) applyOraclePrices(ctx context.Context, price float64, req *PricingQuoteRequest) (float64, error) {
	if len(pe.priceOracles) == 0 {
		return price, nil
	}
	
	oracleRequest := &PriceRequest{
		MethodologyCode: req.MethodologyCode,
		RegionCode:      req.RegionCode,
		VintageYear:     req.VintageYear,
		Tons:            req.Tons,
		Quality:         0.0, // Will be calculated from quality factors
	}
	
	// Calculate quality score
	if req.QualityFactors != nil {
		total := 0.0
		count := 0
		for _, value := range req.QualityFactors {
			total += value
			count++
		}
		if count > 0 {
			oracleRequest.Quality = total / float64(count)
		}
	}
	
	// Get prices from oracles
	var weightedPrice float64
	var totalWeight float64
	
	for _, oracle := range pe.priceOracles {
		response, err := oracle.GetPrice(ctx, oracleRequest)
		if err != nil {
			continue // Skip failed oracles
		}
		
		weight := oracle.GetReliability()
		weightedPrice += response.Price * weight
		totalWeight += weight
	}
	
	if totalWeight > 0 {
		oraclePrice := weightedPrice / totalWeight
		weight := pe.config.OracleWeight
		blendedPrice := price*(1-weight) + oraclePrice*weight
		return blendedPrice, nil
	}
	
	return price, nil
}

// applyPriceLimits applies price limits
func (pe *PricingEngine) applyPriceLimits(price float64) float64 {
	return math.Max(pe.config.MinPrice, math.Min(pe.config.MaxPrice, price))
}

// generatePricingFactorsList generates list of pricing factors for response
func (pe *PricingEngine) generatePricingFactorsList(factors *PricingFactors) []string {
	factorList := []string{
		fmt.Sprintf("Quality multiplier: %.2f", factors.QualityMultiplier),
		fmt.Sprintf("Vintage multiplier: %.2f", factors.VintageMultiplier),
		fmt.Sprintf("Region multiplier: %.2f", factors.RegionMultiplier),
		fmt.Sprintf("Market multiplier: %.2f", factors.MarketMultiplier),
	}
	
	for coBenefit, value := range factors.CoBenefits {
		factorList = append(factorList, fmt.Sprintf("Co-benefit %s: %.2f", coBenefit, value))
	}
	
	return factorList
}

// createDefaultPricingModel creates a default pricing model
func (pe *PricingEngine) createDefaultPricingModel(methodology, region string, vintage int) *CreditPricingModel {
	return &CreditPricingModel{
		ID:                uuid.New(),
		MethodologyCode:   methodology,
		RegionCode:        &region,
		VintageYear:       &vintage,
		BasePrice:         pe.config.DefaultBasePrice,
		QualityMultiplier: QualityMultiplier{
			"data_quality": 1.0,
			"verification": 1.0,
			"monitoring":   1.0,
		},
		MarketMultiplier:  1.0,
		ValidFrom:        time.Now().AddDate(-1, 0, 0),
		ValidUntil:       func() *time.Time { t := time.Now().AddDate(2, 0, 0); return &t }(),
		IsActive:         true,
		CreatedAt:        time.Now(),
	}
}

// validatePricingModel validates a pricing model
func (pe *PricingEngine) validatePricingModel(model *CreditPricingModel) error {
	if model.MethodologyCode == "" {
		return fmt.Errorf("methodology code is required")
	}
	
	if model.BasePrice <= 0 {
		return fmt.Errorf("base price must be positive")
	}
	
	if model.ValidFrom.After(model.ValidUntil) {
		return fmt.Errorf("valid_from must be before valid_until")
	}
	
	return nil
}

// NewMarketDataProvider creates a new market data provider
func NewMarketDataProvider() *MarketDataProvider {
	return &MarketDataProvider{
		sources: []MarketDataSource{
			NewCMEDataSource(),
			NewCarbonCreditsDataSource(),
		},
	}
}

// Oracle implementations
type CMEOOracle struct{}

func NewCMEOOracle() *CMEOOracle { return &CMEOOracle{} }
func (o *CMEOOracle) GetName() string { return "CME Group" }
func (o *CMEOOracle) GetReliability() float64 { return 0.9 }
func (o *CMEOOracle) GetPrice(ctx context.Context, req *PriceRequest) (*PriceResponse, error) {
	return &PriceResponse{
		Price:      18.5,
		Currency:   "USD",
		Confidence: 0.85,
		Source:     "CME Group",
		Timestamp:  time.Now(),
		ValidUntil: time.Now().Add(1 * time.Hour),
	}, nil
}

type CarbonCreditsOracle struct{}

func NewCarbonCreditsOracle() *CarbonCreditsOracle { return &CarbonCreditsOracle{} }
func (o *CarbonCreditsOracle) GetName() string { return "CarbonCredits.com" }
func (o *CarbonCreditsOracle) GetReliability() float64 { return 0.8 }
func (o *CarbonCreditsOracle) GetPrice(ctx context.Context, req *PriceRequest) (*PriceResponse, error) {
	return &PriceResponse{
		Price:      16.2,
		Currency:   "USD",
		Confidence: 0.75,
		Source:     "CarbonCredits.com",
		Timestamp:  time.Now(),
		ValidUntil: time.Now().Add(1 * time.Hour),
	}, nil
}

type VerraOracle struct{}

func NewVerraOracle() *VerraOracle { return &VerraOracle{} }
func (o *VerraOracle) GetName() string { return "Verra Registry" }
func (o *VerraOracle) GetReliability() float64 { return 0.85 }
func (o *VerraOracle) GetPrice(ctx context.Context, req *PriceRequest) (*PriceResponse, error) {
	return &PriceResponse{
		Price:      17.8,
		Currency:   "USD",
		Confidence: 0.8,
		Source:     "Verra Registry",
		Timestamp:  time.Now(),
		ValidUntil: time.Now().Add(1 * time.Hour),
	}, nil
}

// Market data source implementations
type CMEDateSource struct{}

func NewCMEDataSource() *CMEDateSource { return &CMEDateSource{} }
func (ds *CMEDateSource) GetCurrentPrice(ctx context.Context, methodology, region string) (float64, error) { return 18.5, nil }
func (ds *CMEDateSource) GetHistoricalPrices(ctx context.Context, methodology, region string, startDate, endDate time.Time) ([]*HistoricalPrice, error) {
	return []*HistoricalPrice{}, nil
}
func (ds *CMEDateSource) GetMarketSentiment(ctx context.Context) (MarketSentiment, error) {
	return MarketSentiment{
		Score:       0.2,
		Trend:       "bullish",
		Volatility:  0.4,
		Liquidity:   0.7,
		Description: "Market sentiment is moderately bullish with average volatility",
	}, nil
}

type CarbonCreditsDataSource struct{}

func NewCarbonCreditsDataSource() *CarbonCreditsDataSource { return &CarbonCreditsDataSource{} }
func (ds *CarbonCreditsDataSource) GetCurrentPrice(ctx context.Context, methodology, region string) (float64, error) { return 16.2, nil }
func (ds *CarbonCreditsDataSource) GetHistoricalPrices(ctx context.Context, methodology, region string, startDate, endDate time.Time) ([]*HistoricalPrice, error) {
	return []*HistoricalPrice{}, nil
}
func (ds *CarbonCreditsDataSource) GetMarketSentiment(ctx context.Context) (MarketSentiment, error) {
	return MarketSentiment{
		Score:       0.1,
		Trend:       "neutral",
		Volatility:  0.3,
		Liquidity:   0.8,
		Description: "Market sentiment is neutral with low volatility",
	}, nil
}
