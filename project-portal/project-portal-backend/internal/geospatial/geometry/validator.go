package geometry

import (
	"encoding/json"
	"fmt"
)

var supportedTypes = map[string]struct{}{
	"Point":        {},
	"Polygon":      {},
	"MultiPolygon": {},
	"LineString":   {},
}

type basicGeoJSON struct {
	Type        string          `json:"type"`
	Geometry    json.RawMessage `json:"geometry"`
	Coordinates json.RawMessage `json:"coordinates"`
}

func ValidateGeoJSON(raw json.RawMessage) error {
	var obj basicGeoJSON
	if err := json.Unmarshal(raw, &obj); err != nil {
		return fmt.Errorf("invalid json: %w", err)
	}

	if obj.Type == "Feature" {
		if len(obj.Geometry) == 0 {
			return fmt.Errorf("feature.geometry is required")
		}
		var g basicGeoJSON
		if err := json.Unmarshal(obj.Geometry, &g); err != nil {
			return fmt.Errorf("invalid feature.geometry: %w", err)
		}
		obj = g
	}

	if _, ok := supportedTypes[obj.Type]; !ok {
		return fmt.Errorf("unsupported geometry type: %s", obj.Type)
	}
	if len(obj.Coordinates) == 0 {
		return fmt.Errorf("coordinates are required")
	}
	return validateCoordinates(obj.Type, obj.Coordinates)
}

func validateCoordinates(geometryType string, coords json.RawMessage) error {
	switch geometryType {
	case "Point":
		var p []float64
		if err := json.Unmarshal(coords, &p); err != nil {
			return fmt.Errorf("invalid point coordinates")
		}
		return validateCoordinatePair(p)
	case "LineString":
		var ls [][]float64
		if err := json.Unmarshal(coords, &ls); err != nil {
			return fmt.Errorf("invalid linestring coordinates")
		}
		if len(ls) < 2 {
			return fmt.Errorf("linestring must contain at least 2 points")
		}
		for _, p := range ls {
			if err := validateCoordinatePair(p); err != nil {
				return err
			}
		}
		return nil
	case "Polygon":
		var poly [][][]float64
		if err := json.Unmarshal(coords, &poly); err != nil {
			return fmt.Errorf("invalid polygon coordinates")
		}
		return validatePolygon(poly)
	case "MultiPolygon":
		var mp [][][][]float64
		if err := json.Unmarshal(coords, &mp); err != nil {
			return fmt.Errorf("invalid multipolygon coordinates")
		}
		for _, poly := range mp {
			if err := validatePolygon(poly); err != nil {
				return err
			}
		}
		return nil
	default:
		return fmt.Errorf("unsupported geometry type: %s", geometryType)
	}
}

func validatePolygon(poly [][][]float64) error {
	if len(poly) == 0 {
		return fmt.Errorf("polygon must contain at least one ring")
	}
	for _, ring := range poly {
		if len(ring) < 4 {
			return fmt.Errorf("polygon rings must have at least 4 points")
		}
		for _, p := range ring {
			if err := validateCoordinatePair(p); err != nil {
				return err
			}
		}
		first := ring[0]
		last := ring[len(ring)-1]
		if len(first) < 2 || len(last) < 2 || first[0] != last[0] || first[1] != last[1] {
			return fmt.Errorf("polygon rings must be closed")
		}
	}
	return nil
}

func validateCoordinatePair(p []float64) error {
	if len(p) < 2 {
		return fmt.Errorf("each coordinate must have longitude and latitude")
	}
	lon := p[0]
	lat := p[1]
	if lon < -180 || lon > 180 {
		return fmt.Errorf("longitude out of range: %v", lon)
	}
	if lat < -90 || lat > 90 {
		return fmt.Errorf("latitude out of range: %v", lat)
	}
	return nil
}
