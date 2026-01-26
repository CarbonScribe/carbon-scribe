package geospatial

import (
	"encoding/json"
	"errors"

	"github.com/paulmach/orb"
	"github.com/paulmach/orb/geojson"
)

// ValidateGeoJSON validates a GeoJSON string
func ValidateGeoJSON(geojsonStr string) (orb.Geometry, error) {
	var raw map[string]interface{}
	err := json.Unmarshal([]byte(geojsonStr), &raw)
	if err != nil {
		return nil, err
	}

	feature, err := geojson.UnmarshalFeature([]byte(geojsonStr))
	if err != nil {
		return nil, err
	}

	if feature.Geometry == nil {
		return nil, errors.New("invalid GeoJSON: no geometry")
	}

	return feature.Geometry, nil
}

// CalculateArea calculates the area in square meters for a geometry
func CalculateArea(geometry orb.Geometry) float64 {
	return orb.Area(geometry)
}

// CalculateCentroid calculates the centroid of a geometry
func CalculateCentroid(geometry orb.Geometry) orb.Point {
	return orb.Centroid(geometry)
}

// CheckOverlap checks if two geometries overlap
func CheckOverlap(g1, g2 orb.Geometry) bool {
	return orb.Overlaps(g1, g2)
}

// ConvertToHectares converts square meters to hectares
func ConvertToHectares(sqMeters float64) float64 {
	return sqMeters / 10000
}