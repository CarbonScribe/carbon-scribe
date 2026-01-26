package geospatial

import (
	"encoding/json"
	"errors"
	"math"
)

// ValidateGeoJSON validates the input as JSON and checks for a "type" field
func ValidateGeoJSON(input string) (map[string]interface{}, error) {
	var data map[string]interface{}
	err := json.Unmarshal([]byte(input), &data)
	if err != nil {
		return nil, err
	}
	if _, ok := data["type"]; !ok {
		return nil, errors.New("missing 'type' field in GeoJSON")
	}
	return data, nil
}

// CalculateArea calculates the area of a GeoJSON geometry
// Currently supports Polygon type, returns 0 for others
func CalculateArea(geom map[string]interface{}) float64 {
	geomType, ok := geom["type"].(string)
	if !ok || geomType != "Polygon" {
		return 0
	}
	coordinates, ok := geom["coordinates"].([]interface{})
	if !ok || len(coordinates) == 0 {
		return 0
	}
	// For Polygon, coordinates[0] is the outer ring
	ring, ok := coordinates[0].([]interface{})
	if !ok || len(ring) < 4 { // Need at least 4 points for a closed polygon
		return 0
	}
	// Shoelace formula
	var area float64
	n := len(ring)
	for i := 0; i < n; i++ {
		j := (i + 1) % n
		pointI, okI := ring[i].([]interface{})
		pointJ, okJ := ring[j].([]interface{})
		if !okI || !okJ || len(pointI) < 2 || len(pointJ) < 2 {
			return 0
		}
		xI, okXI := pointI[0].(float64)
		yI, okYI := pointI[1].(float64)
		xJ, okXJ := pointJ[0].(float64)
		yJ, okYJ := pointJ[1].(float64)
		if !okXI || !okYI || !okXJ || !okYJ {
			return 0
		}
		area += xI*yJ - xJ*yI
	}
	return math.Abs(area) / 2
}

// ConvertToHectares converts square meters to hectares
func ConvertToHectares(areaSqM float64) float64 {
	return areaSqM / 10000
}
