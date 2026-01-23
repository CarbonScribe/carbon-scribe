package sales

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// Local type definitions to avoid import cycle

// QualityMultiplier represents quality factors for pricing
type QualityMultiplier map[string]float64

// PricingQuoteRequest represents a pricing quote request
type PricingQuoteRequest struct {
	MethodologyCode string            `json:"methodology_code" binding:"required"`
	RegionCode      string            `json:"region_code"`
	VintageYear     int               `json:"vintage_year"`
	Tons            float64           `json:"tons" binding:"required,gt=0"`
	QualityFactors  QualityMultiplier `json:"quality_factors"`
}

// AuctionManager manages carbon credit auctions
type AuctionManager struct {
	repository     AuctionRepository
	pricingEngine  *PricingEngine
	paymentProcessor *PaymentProcessor
	config         *AuctionConfig
}

// AuctionRepository defines the interface for auction data access
type AuctionRepository interface {
	CreateAuction(ctx context.Context, auction *CarbonAuction) error
	GetAuction(ctx context.Context, auctionID uuid.UUID) (*CarbonAuction, error)
	UpdateAuction(ctx context.Context, auction *CarbonAuction) error
	ListAuctions(ctx context.Context, filters *AuctionFilters) ([]*CarbonAuction, error)
	CreateBid(ctx context.Context, bid *AuctionBid) error
	GetAuctionBids(ctx context.Context, auctionID uuid.UUID) ([]*AuctionBid, error)
	UpdateBid(ctx context.Context, bid *AuctionBid) error
}

// AuctionFilters represents filters for listing auctions
type AuctionFilters struct {
	Status      []AuctionStatus `json:"status,omitempty"`
	ProjectID   *uuid.UUID      `json:"project_id,omitempty"`
	Methodology *string         `json:"methodology,omitempty"`
	MinTons     *float64        `json:"min_tons,omitempty"`
	MaxTons     *float64        `json:"max_tons,omitempty"`
	StartTime   *time.Time      `json:"start_time,omitempty"`
	EndTime     *time.Time      `json:"end_time,omitempty"`
	Limit       *int            `json:"limit,omitempty"`
	Offset      *int            `json:"offset,omitempty"`
}

// AuctionConfig holds configuration for auctions
type AuctionConfig struct {
	MinBidIncrement      float64 `json:"min_bid_increment"`
	MaxBidIncrement      float64 `json:"max_bid_increment"`
	DefaultBidIncrement  float64 `json:"default_bid_increment"`
	MinReservePrice      float64 `json:"min_reserve_price"`
	MaxReservePrice      float64 `json:"max_reserve_price"`
	DefaultReservePrice  float64 `json:"default_reserve_price"`
	AutoExtendMinutes    int     `json:"auto_extend_minutes"`
	BidDepositPercent    float64 `json:"bid_deposit_percent"`
	MaxActiveAuctions    int     `json:"max_active_auctions"`
	AuctionDurationHours int     `json:"auction_duration_hours"`
}

// CarbonAuction represents a carbon credit auction
type CarbonAuction struct {
	ID              uuid.UUID      `json:"id"`
	ProjectID       uuid.UUID      `json:"project_id"`
	Methodology     string         `json:"methodology"`
	VintageYear     int            `json:"vintage_year"`
	TonsAvailable   float64        `json:"tons_available"`
	AuctionType     AuctionType    `json:"auction_type"`
	StartingPrice   float64        `json:"starting_price"`
	ReservePrice    float64        `json:"reserve_price"`
	CurrentPrice    float64        `json:"current_price"`
	BidIncrement    float64        `json:"bid_increment"`
	StartTime       time.Time      `json:"start_time"`
	EndTime         time.Time      `json:"end_time"`
	AutoEndTime     *time.Time     `json:"auto_end_time"`
	Status          AuctionStatus  `json:"status"`
	WinnerID        *uuid.UUID     `json:"winner_id"`
	WinningBid      *float64       `json:"winning_bid"`
	WinningTons     *float64       `json:"winning_tons"`
	TotalBids       int            `json:"total_bids"`
	TotalValue      float64        `json:"total_value"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// AuctionType represents the type of auction
type AuctionType string

const (
	AuctionTypeEnglish      AuctionType = "english"      // Ascending price
	AuctionTypeDutch        AuctionType = "dutch"        // Descending price
	AuctionTypeSealedBid    AuctionType = "sealed_bid"    // Single round sealed bid
	AuctionTypeVickrey      AuctionType = "vickrey"      // Second-price sealed bid
)

// AuctionStatus represents the status of an auction
type AuctionStatus string

const (
	AuctionStatusScheduled  AuctionStatus = "scheduled"
	AuctionStatusActive     AuctionStatus = "active"
	AuctionStatusEnded      AuctionStatus = "ended"
	AuctionStatusCompleted  AuctionStatus = "completed"
	AuctionStatusCancelled  AuctionStatus = "cancelled"
)

// AuctionBid represents a bid in an auction
type AuctionBid struct {
	ID          uuid.UUID `json:"id"`
	AuctionID   uuid.UUID `json:"auction_id"`
	BidderID    uuid.UUID `json:"bidder_id"`
	BidAmount   float64   `json:"bid_amount"`
	TonsRequested float64 `json:"tons_requested"`
	PricePerTon float64   `json:"price_per_ton"`
	IsWinning   bool      `json:"is_winning"`
	BidTime     time.Time `json:"bid_time"`
	DepositPaid bool      `json:"deposit_paid"`
	DepositTxID *string   `json:"deposit_tx_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AuctionRequest represents a request to create an auction
type AuctionRequest struct {
	ProjectID      uuid.UUID   `json:"project_id" binding:"required"`
	Methodology    string      `json:"methodology" binding:"required"`
	VintageYear    int         `json:"vintage_year" binding:"required"`
	TonsAvailable  float64     `json:"tons_available" binding:"required,gt=0"`
	AuctionType    AuctionType `json:"auction_type" binding:"required"`
	StartingPrice  float64     `json:"starting_price" binding:"required,gt=0"`
	ReservePrice   float64     `json:"reserve_price"`
	BidIncrement   float64     `json:"bid_increment"`
	StartTime      time.Time    `json:"start_time"`
	DurationHours  int          `json:"duration_hours"`
}

// AuctionResponse represents the response from auction creation
type AuctionResponse struct {
	AuctionID      uuid.UUID   `json:"auction_id"`
	EstimatedPrice float64     `json:"estimated_price"`
	MarketValue    float64     `json:"market_value"`
	Status         AuctionStatus `json:"status"`
	StartTime      time.Time   `json:"start_time"`
	EndTime        time.Time   `json:"end_time"`
	CreatedAt      time.Time   `json:"created_at"`
}

// BidRequest represents a bid request
type BidRequest struct {
	AuctionID     uuid.UUID `json:"auction_id" binding:"required"`
	BidderID      uuid.UUID `json:"bidder_id" binding:"required"`
	BidAmount     float64   `json:"bid_amount" binding:"required,gt=0"`
	TonsRequested float64   `json:"tons_requested" binding:"required,gt=0"`
	MaxPricePerTon float64  `json:"max_price_per_ton"`
}

// BidResponse represents the response from placing a bid
type BidResponse struct {
	BidID       uuid.UUID `json:"bid_id"`
	Status      string    `json:"status"`
	CurrentPrice float64  `json:"current_price"`
	IsWinning   bool      `json:"is_winning"`
	DepositRequired float64 `json:"deposit_required"`
	DepositPaid bool      `json:"deposit_paid"`
	BidTime     time.Time `json:"bid_time"`
}

// PaymentProcessor handles auction payments
type PaymentProcessor struct {
	provider string
	config   map[string]interface{}
}

// NewAuctionManager creates a new auction manager
func NewAuctionManager(repository AuctionRepository, pricingEngine *PricingEngine, config *AuctionConfig) *AuctionManager {
	if config == nil {
		config = &AuctionConfig{
			MinBidIncrement:     0.50, // $0.50 per ton
			MaxBidIncrement:     5.00, // $5.00 per ton
			DefaultBidIncrement: 1.00, // $1.00 per ton
			MinReservePrice:     5.0,  // $5 per ton
			MaxReservePrice:     100.0, // $100 per ton
			DefaultReservePrice: 10.0, // $10 per ton
			AutoExtendMinutes:   5,    // 5 minutes
			BidDepositPercent:   10.0, // 10%
			MaxActiveAuctions:   50,
			AuctionDurationHours: 24,
		}
	}
	
	return &AuctionManager{
		repository:       repository,
		pricingEngine:    pricingEngine,
		paymentProcessor: NewPaymentProcessor(),
		config:          config,
	}
}

// CreateAuction creates a new carbon credit auction
func (am *AuctionManager) CreateAuction(ctx context.Context, req *AuctionRequest) (*AuctionResponse, error) {
	// Validate request
	if err := am.validateAuctionRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	// Get market price estimate
	quoteReq := &PricingQuoteRequest{
		MethodologyCode: req.Methodology,
		RegionCode:      "", // Will be determined from project
		VintageYear:     req.VintageYear,
		Tons:            req.TonsAvailable,
	}
	
	quote, err := am.pricingEngine.GetPriceQuote(ctx, quoteReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get price quote: %w", err)
	}
	
	// Set default values
	bidIncrement := req.BidIncrement
	if bidIncrement == 0 {
		bidIncrement = am.config.DefaultBidIncrement
	}
	
	reservePrice := req.ReservePrice
	if reservePrice == 0 {
		reservePrice = am.config.DefaultReservePrice
	}
	
	// Set start and end times
	startTime := req.StartTime
	if startTime.IsZero() {
		startTime = time.Now().Add(1 * time.Hour) // Start in 1 hour
	}
	
	duration := req.DurationHours
	if duration == 0 {
		duration = am.config.AuctionDurationHours
	}
	endTime := startTime.Add(time.Duration(duration) * time.Hour)
	
	// Create auction
	auction := &CarbonAuction{
		ID:            uuid.New(),
		ProjectID:     req.ProjectID,
		Methodology:   req.Methodology,
		VintageYear:   req.VintageYear,
		TonsAvailable: req.TonsAvailable,
		AuctionType:   req.AuctionType,
		StartingPrice: req.StartingPrice,
		ReservePrice:  reservePrice,
		CurrentPrice:  req.StartingPrice,
		BidIncrement:  bidIncrement,
		StartTime:     startTime,
		EndTime:       endTime,
		Status:        AuctionStatusScheduled,
		TotalBids:     0,
		TotalValue:    0,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	
	// Save to database
	if err := am.repository.CreateAuction(ctx, auction); err != nil {
		return nil, fmt.Errorf("failed to create auction: %w", err)
	}
	
	return &AuctionResponse{
		AuctionID:      auction.ID,
		EstimatedPrice: quote.AdjustedPrice,
		MarketValue:    quote.TotalPrice,
		Status:         auction.Status,
		StartTime:      auction.StartTime,
		EndTime:        auction.EndTime,
		CreatedAt:      auction.CreatedAt,
	}, nil
}

// PlaceBid places a bid in an auction
func (am *AuctionManager) PlaceBid(ctx context.Context, req *BidRequest) (*BidResponse, error) {
	// Get auction
	auction, err := am.repository.GetAuction(ctx, req.AuctionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get auction: %w", err)
	}
	
	// Validate auction status
	if auction.Status != AuctionStatusActive {
		return nil, fmt.Errorf("auction is not active")
	}
	
	// Check if auction has ended
	if time.Now().After(auction.EndTime) {
		return nil, fmt.Errorf("auction has ended")
	}
	
	// Validate bid
	if err := am.validateBid(req, auction); err != nil {
		return nil, fmt.Errorf("bid validation failed: %w", err)
	}
	
	// Calculate price per ton
	pricePerTon := req.BidAmount / req.TonsRequested
	
	// Check max price per ton if specified
	if req.MaxPricePerTon > 0 && pricePerTon > req.MaxPricePerTon {
		return nil, fmt.Errorf("price per ton exceeds maximum")
	}
	
	// Create bid
	bid := &AuctionBid{
		ID:            uuid.New(),
		AuctionID:     req.AuctionID,
		BidderID:      req.BidderID,
		BidAmount:     req.BidAmount,
		TonsRequested: req.TonsRequested,
		PricePerTon:   pricePerTon,
		IsWinning:     false,
		BidTime:       time.Now(),
		DepositPaid:   false,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	
	// Process bid based on auction type
	switch auction.AuctionType {
	case AuctionTypeEnglish:
		err = am.processEnglishBid(ctx, bid, auction)
	case AuctionTypeDutch:
		err = am.processDutchBid(ctx, bid, auction)
	case AuctionTypeSealedBid:
		err = am.processSealedBid(ctx, bid, auction)
	case AuctionTypeVickrey:
		err = am.processVickreyBid(ctx, bid, auction)
	default:
		return nil, fmt.Errorf("unsupported auction type: %s", auction.AuctionType)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to process bid: %w", err)
	}
	
	// Save bid
	if err := am.repository.CreateBid(ctx, bid); err != nil {
		return nil, fmt.Errorf("failed to save bid: %w", err)
	}
	
	// Update auction
	auction.TotalBids++
	auction.TotalValue += req.BidAmount
	auction.UpdatedAt = time.Now()
	
	// Update current price for English auction
	if auction.AuctionType == AuctionTypeEnglish && pricePerTon > auction.CurrentPrice {
		auction.CurrentPrice = pricePerTon
		
		// Auto-extend auction if bid is placed near end
		if time.Until(auction.EndTime) < time.Duration(am.config.AutoExtendMinutes)*time.Minute {
			auction.EndTime = time.Now().Add(time.Duration(am.config.AutoExtendMinutes) * time.Minute)
		}
	}
	
	if err := am.repository.UpdateAuction(ctx, auction); err != nil {
		return nil, fmt.Errorf("failed to update auction: %w", err)
	}
	
	// Calculate deposit required
	depositRequired := req.BidAmount * (am.config.BidDepositPercent / 100.0)
	
	return &BidResponse{
		BidID:           bid.ID,
		Status:          "accepted",
		CurrentPrice:    auction.CurrentPrice,
		IsWinning:       bid.IsWinning,
		DepositRequired: depositRequired,
		DepositPaid:     bid.DepositPaid,
		BidTime:         bid.BidTime,
	}, nil
}

// processEnglishBid processes an English auction bid
func (am *AuctionManager) processEnglishBid(ctx context.Context, bid *AuctionBid, auction *CarbonAuction) error {
	// Check if bid meets minimum increment
	minBid := auction.CurrentPrice + auction.BidIncrement
	if bid.PricePerTon < minBid {
		return fmt.Errorf("bid must be at least %.2f per ton", minBid)
	}
	
	// Mark as winning (highest bid wins)
	bid.IsWinning = true
	
	// Mark previous winning bids as losing
	bids, err := am.repository.GetAuctionBids(ctx, auction.ID)
	if err != nil {
		return fmt.Errorf("failed to get auction bids: %w", err)
	}
	
	for _, existingBid := range bids {
		if existingBid.IsWinning && existingBid.ID != bid.ID {
			existingBid.IsWinning = false
			am.repository.UpdateBid(ctx, existingBid)
		}
	}
	
	return nil
}

// processDutchBid processes a Dutch auction bid
func (am *AuctionManager) processDutchBid(ctx context.Context, bid *AuctionBid, auction *CarbonAuction) error {
	// In Dutch auction, first bid at or above current price wins
	if bid.PricePerTon >= auction.CurrentPrice {
		bid.IsWinning = true
		
		// End auction immediately
		auction.Status = AuctionStatusEnded
		auction.WinnerID = &bid.BidderID
		auction.WinningBid = &bid.BidAmount
		auction.WinningTons = &bid.TonsRequested
		
		return nil
	}
	
	return fmt.Errorf("bid price is below current price")
}

// processSealedBid processes a sealed bid auction
func (am *AuctionManager) processSealedBid(ctx context.Context, bid *AuctionBid, auction *CarbonAuction) error {
	// In sealed bid, all bids are accepted but winner determined at end
	bid.IsWinning = false // Will be determined later
	return nil
}

// processVickreyBid processes a Vickrey auction bid
func (am *AuctionManager) processVickreyBid(ctx context.Context, bid *AuctionBid, auction *CarbonAuction) error {
	// Similar to sealed bid, but winner pays second-highest price
	bid.IsWinning = false // Will be determined later
	return nil
}

// EndAuction ends an auction and determines winner
func (am *AuctionManager) EndAuction(ctx context.Context, auctionID uuid.UUID) error {
	auction, err := am.repository.GetAuction(ctx, auctionID)
	if err != nil {
		return fmt.Errorf("failed to get auction: %w", err)
	}
	
	if auction.Status != AuctionStatusActive {
		return fmt.Errorf("auction is not active")
	}
	
	// Get all bids
	bids, err := am.repository.GetAuctionBids(ctx, auctionID)
	if err != nil {
		return fmt.Errorf("failed to get auction bids: %w", err)
	}
	
	// Process based on auction type
	switch auction.AuctionType {
	case AuctionTypeEnglish:
		err = am.endEnglishAuction(ctx, auction, bids)
	case AuctionTypeSealedBid:
		err = am.endSealedBidAuction(ctx, auction, bids)
	case AuctionTypeVickrey:
		err = am.endVickreyAuction(ctx, auction, bids)
	case AuctionTypeDutch:
		// Dutch auction ends when first bid is placed
		if auction.Status == AuctionStatusEnded {
			err = am.finalizeDutchAuction(ctx, auction)
		}
	}
	
	if err != nil {
		return fmt.Errorf("failed to end auction: %w", err)
	}
	
	// Update auction status
	auction.Status = AuctionStatusCompleted
	auction.UpdatedAt = time.Now()
	
	return am.repository.UpdateAuction(ctx, auction)
}

// endEnglishAuction ends an English auction
func (am *AuctionManager) endEnglishAuction(ctx context.Context, auction *CarbonAuction, bids []*AuctionBid) error {
	// Find highest bid
	var highestBid *AuctionBid
	for _, bid := range bids {
		if highestBid == nil || bid.PricePerTon > highestBid.PricePerTon {
			highestBid = bid
		}
	}
	
	if highestBid != nil && highestBid.PricePerTon >= auction.ReservePrice {
		auction.WinnerID = &highestBid.BidderID
		auction.WinningBid = &highestBid.BidAmount
		auction.WinningTons = &highestBid.TonsRequested
		highestBid.IsWinning = true
		am.repository.UpdateBid(ctx, highestBid)
	}
	
	return nil
}

// endSealedBidAuction ends a sealed bid auction
func (am *AuctionManager) endSealedBidAuction(ctx context.Context, auction *CarbonAuction, bids []*AuctionBid) error {
	// Find highest bid
	var highestBid *AuctionBid
	for _, bid := range bids {
		if highestBid == nil || bid.PricePerTon > highestBid.PricePerTon {
			highestBid = bid
		}
	}
	
	if highestBid != nil && highestBid.PricePerTon >= auction.ReservePrice {
		auction.WinnerID = &highestBid.BidderID
		auction.WinningBid = &highestBid.BidAmount
		auction.WinningTons = &highestBid.TonsRequested
		highestBid.IsWinning = true
		am.repository.UpdateBid(ctx, highestBid)
	}
	
	return nil
}

// endVickreyAuction ends a Vickrey auction
func (am *AuctionManager) endVickreyAuction(ctx context.Context, auction *CarbonAuction, bids []*AuctionBid) error {
	if len(bids) < 2 {
		// If only one bid, treat as sealed bid
		return am.endSealedBidAuction(ctx, auction, bids)
	}
	
	// Sort bids by price
	sortedBids := make([]*AuctionBid, len(bids))
	copy(sortedBids, bids)
	
	// Simple bubble sort (in production, use more efficient sort)
	for i := 0; i < len(sortedBids); i++ {
		for j := 0; j < len(sortedBids)-1-i; j++ {
			if sortedBids[j].PricePerTon < sortedBids[j+1].PricePerTon {
				sortedBids[j], sortedBids[j+1] = sortedBids[j+1], sortedBids[j]
			}
		}
	}
	
	// Winner pays second-highest price
	winner := sortedBids[0]
	secondPrice := sortedBids[1].PricePerTon
	
	if secondPrice >= auction.ReservePrice {
		auction.WinnerID = &winner.BidderID
		auction.WinningBid = &winner.BidAmount
		auction.WinningTons = &winner.TonsRequested
		winner.IsWinning = true
		
		// Adjust winning bid to second price
		adjustedAmount := secondPrice * winner.TonsRequested
		auction.WinningBid = &adjustedAmount
		
		am.repository.UpdateBid(ctx, winner)
	}
	
	return nil
}

// finalizeDutchAuction finalizes a Dutch auction
func (am *AuctionManager) finalizeDutchAuction(ctx context.Context, auction *CarbonAuction) error {
	// Dutch auction already has winner from bid processing
	// Just need to ensure reserve price was met
	if auction.WinningBid != nil && *auction.WinningBid/(*auction.WinningTons) >= auction.ReservePrice {
		return nil
	}
	
	// Cancel if reserve not met
	auction.Status = AuctionStatusCancelled
	return nil
}

// validateAuctionRequest validates auction creation request
func (am *AuctionManager) validateAuctionRequest(req *AuctionRequest) error {
	// Validate bid increment
	if req.BidIncrement > 0 && (req.BidIncrement < am.config.MinBidIncrement || req.BidIncrement > am.config.MaxBidIncrement) {
		return fmt.Errorf("bid increment must be between %.2f and %.2f", am.config.MinBidIncrement, am.config.MaxBidIncrement)
	}
	
	// Validate reserve price
	if req.ReservePrice > 0 && (req.ReservePrice < am.config.MinReservePrice || req.ReservePrice > am.config.MaxReservePrice) {
		return fmt.Errorf("reserve price must be between %.2f and %.2f", am.config.MinReservePrice, am.config.MaxReservePrice)
	}
	
	// Validate starting price vs reserve price
	if req.ReservePrice > 0 && req.StartingPrice < req.ReservePrice {
		return fmt.Errorf("starting price cannot be below reserve price")
	}
	
	// Validate auction type
	validTypes := map[AuctionType]bool{
		AuctionTypeEnglish:   true,
		AuctionTypeDutch:     true,
		AuctionTypeSealedBid: true,
		AuctionTypeVickrey:   true,
	}
	
	if !validTypes[req.AuctionType] {
		return fmt.Errorf("invalid auction type: %s", req.AuctionType)
	}
	
	return nil
}

// validateBid validates a bid
func (am *AuctionManager) validateBid(req *BidRequest, auction *CarbonAuction) error {
	// Check if tons requested exceeds available
	if req.TonsRequested > auction.TonsAvailable {
		return fmt.Errorf("requested tons exceed available tons")
	}
	
	// For English auction, check minimum bid
	if auction.AuctionType == AuctionTypeEnglish {
		minBid := auction.CurrentPrice + auction.BidIncrement
		pricePerTon := req.BidAmount / req.TonsRequested
		if pricePerTon < minBid {
			return fmt.Errorf("bid must be at least %.2f per ton", minBid)
		}
	}
	
	return nil
}

// NewPaymentProcessor creates a new payment processor
func NewPaymentProcessor() *PaymentProcessor {
	return &PaymentProcessor{
		provider: "stripe",
		config:   make(map[string]interface{}),
	}
}
