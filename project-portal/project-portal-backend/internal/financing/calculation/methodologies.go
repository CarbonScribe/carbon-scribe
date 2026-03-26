package calculation

import "strings"

var methodologyFactors = map[string]float64{
	"VM0007": 0.82,
	"VM0015": 1.07,
	"VM0033": 1.21,
}

func NormalizeMethodology(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func SupportedMethodology(code string) bool {
	_, ok := methodologyFactors[NormalizeMethodology(code)]
	return ok
}

func FactorFor(code string) float64 {
	normalized := NormalizeMethodology(code)
	factor, ok := methodologyFactors[normalized]
	if !ok {
		return 1.0
	}
	return factor
}
