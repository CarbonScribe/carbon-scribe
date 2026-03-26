package calculation

import (
	"math"
)

type Input struct {
	MethodologyCode string
	AreaHectares    float64
	DataQuality     float64
	MonitoringData  map[string]float64
}

type Result struct {
	CalculatedTons       float64
	BufferedTons         float64
	UncertaintyBufferPct float64
	AuditTrail           map[string]interface{}
}

type Engine struct{}

func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Calculate(input Input) Result {
	factor := FactorFor(input.MethodologyCode)
	biomass := input.MonitoringData["biomass_tons"]
	soil := input.MonitoringData["soil_carbon_tons"]
	ndvi := input.MonitoringData["ndvi_score"]
	leakage := input.MonitoringData["leakage_risk"]

	methodologyBase := input.AreaHectares * factor
	biomassAdjustment := biomass * 0.58
	soilAdjustment := soil * 0.37
	ndviAdjustment := ndvi * input.AreaHectares * 0.12
	leakagePenalty := math.Max(0, leakage) * 0.2 * methodologyBase

	calculated := math.Max(0, methodologyBase+biomassAdjustment+soilAdjustment+ndviAdjustment-leakagePenalty)
	bufferPct := uncertaintyBufferPercent(input.DataQuality)
	buffered := calculated * (1 - bufferPct/100)

	return Result{
		CalculatedTons:       round4(calculated),
		BufferedTons:         round4(buffered),
		UncertaintyBufferPct: round4(bufferPct),
		AuditTrail: map[string]interface{}{
			"methodology_factor":     factor,
			"methodology_base":       round4(methodologyBase),
			"biomass_adjustment":     round4(biomassAdjustment),
			"soil_adjustment":        round4(soilAdjustment),
			"ndvi_adjustment":        round4(ndviAdjustment),
			"leakage_penalty":        round4(leakagePenalty),
			"uncertainty_buffer_pct": round4(bufferPct),
		},
	}
}

func uncertaintyBufferPercent(dataQuality float64) float64 {
	quality := dataQuality
	if quality < 0 {
		quality = 0
	}
	if quality > 1 {
		quality = 1
	}
	buffer := 5 + (1-quality)*25
	if buffer < 5 {
		return 5
	}
	if buffer > 30 {
		return 30
	}
	return buffer
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
