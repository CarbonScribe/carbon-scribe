package geospatial

import (
	"encoding/json"
	"errors"
	"math"
)

// ValidateGeoJSON validates that the input is valid JSON and contains a "type" field
func ValidateGeoJSON(input string) (map[string]interface{}, error) {
	var parsed map[string]interface{}
	err := json.Unmarshal([]byte(input), &parsed)
	if err != nil {
		return nil, err
	}
	if _, ok := parsed["type"]; !ok {
		return nil, errors.New("invalid GeoJSON: missing type field")
	}
	return parsed, nil
}

// CalculateArea calculates the area for a geometry map, returns 0 if unsupported or missing
func CalculateArea(geom map[string]interface{}) float64 {
	geomType, ok := geom["type"].(string)
	if !ok {
		return 0
	}
	if geomType != "Polygon" {
		return 0
	}
	coordinates, ok := geom["coordinates"].([]interface{})
	if !ok || len(coordinates) == 0 {
		return 0
	}
	ring, ok := coordinates[0].([]interface{})
	if !ok {
		return 0
	}
	return calculatePolygonArea(ring)
}

// calculatePolygonArea calculates area using shoelace formula for a ring of coordinates
func calculatePolygonArea(ring []interface{}) float64 {
	if len(ring) < 4 { // need at least 4 points for closed polygon
		return 0
	}
	var area float64
	n := len(ring) - 1 // last point same as first
	for i := 0; i < n; i++ {
		p1, ok1 := ring[i].([]interface{})
		p2, ok2 := ring[(i+1)%n].([]interface{})
		if !ok1 || !ok2 || len(p1) < 2 || len(p2) < 2 {
			return 0
		}
		x1, ok1 := p1[0].(float64)
		y1, ok1 := p1[1].(float64)
		x2, ok2 := p2[0].(float64)
		y2, ok2 := p2[1].(float64)
		if !ok1 || !ok2 {
			return 0
		}
		area += x1*y2 - x2*y1
	}
	return math.Abs(area) / 2
}

// ConvertToHectares converts square meters to hectares
func ConvertToHectares(areaSqM float64) float64 {
	return areaSqM / 10000
}
