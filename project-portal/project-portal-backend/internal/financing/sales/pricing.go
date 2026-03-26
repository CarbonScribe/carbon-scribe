package sales

import "math"

type PricingModel struct {
	BasePrice         float64
	MarketMultiplier  float64
	QualityMultiplier map[string]float64
}

type QuoteInput struct {
	MethodologyCode string
	RegionCode      string
	VintageYear     int
	DataQuality     float64
	MarketSpread    float64
}

type QuoteOutput struct {
	PricePerTon      float64
	QualityFactor    float64
	MarketMultiplier float64
}

type PricingEngine struct{}

func NewPricingEngine() *PricingEngine {
	return &PricingEngine{}
}

func (e *PricingEngine) Quote(model PricingModel, input QuoteInput) QuoteOutput {
	marketMultiplier := model.MarketMultiplier
	if marketMultiplier <= 0 {
		marketMultiplier = 1.0
	}
	qualityFactor := 0.8 + (clamp(input.DataQuality, 0, 1) * 0.4)
	if custom, ok := model.QualityMultiplier[input.MethodologyCode]; ok && custom > 0 {
		qualityFactor *= custom
	}
	if input.MarketSpread > 0 {
		marketMultiplier *= input.MarketSpread
	}
	price := model.BasePrice * marketMultiplier * qualityFactor
	return QuoteOutput{
		PricePerTon:      round4(price),
		QualityFactor:    round4(qualityFactor),
		MarketMultiplier: round4(marketMultiplier),
	}
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
