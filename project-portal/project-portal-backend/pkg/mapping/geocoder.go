package mapping

import "fmt"

func ReverseGeocodePlaceholder(lat, lon float64) string {
	return fmt.Sprintf("%.6f, %.6f", lat, lon)
}
