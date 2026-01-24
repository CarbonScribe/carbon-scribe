package geometry

import (
	"fmt"
	"math"

	"carbon-scribe/project-portal/project-portal-backend/pkg/postgis"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Calculator provides geometric calculations
type Calculator struct {
	spatial *postgis.SpatialFunctions
}

// NewCalculator creates a new geometry calculator
func NewCalculator(db *gorm.DB) *Calculator {
	return &Calculator{
		spatial: postgis.NewSpatialFunctions(db),
	}
}

// CalculateAreaMetrics computes comprehensive area metrics
type AreaMetrics struct {
	SquareMeters  decimal.Decimal
	Hectares      decimal.Decimal
	Acres         decimal.Decimal
	SquareKm      decimal.Decimal
}

// CalculateArea returns area in multiple units
func (c *Calculator) CalculateArea(wkt string) (*AreaMetrics, error) {
	areaM2, err := c.spatial.CalculateArea(wkt)
	if err != nil {
		return nil, err
	}

	hectares := areaM2.Div(decimal.NewFromInt(10000))
	acres := areaM2.Div(decimal.NewFromFloat(4046.86))
	squareKm := areaM2.Div(decimal.NewFromInt(1000000))

	return &AreaMetrics{
		SquareMeters: areaM2,
		Hectares:     hectares,
		Acres:        acres,
		SquareKm:     squareKm,
	}, nil
}

// PerimeterMetrics contains perimeter measurements
type PerimeterMetrics struct {
	Meters     decimal.Decimal
	Kilometers decimal.Decimal
	Miles      decimal.Decimal
}

// CalculatePerimeter returns perimeter in multiple units
func (c *Calculator) CalculatePerimeter(wkt string) (*PerimeterMetrics, error) {
	perimeterM, err := c.spatial.CalculatePerimeter(wkt)
	if err != nil {
		return nil, err
	}

	kilometers := perimeterM.Div(decimal.NewFromInt(1000))
	miles := perimeterM.Div(decimal.NewFromFloat(1609.34))

	return &PerimeterMetrics{
		Meters:     perimeterM,
		Kilometers: kilometers,
		Miles:      miles,
	}, nil
}

// DistanceMetrics contains distance measurements
type DistanceMetrics struct {
	Meters     decimal.Decimal
	Kilometers decimal.Decimal
	Miles      decimal.Decimal
}

// CalculateDistance calculates distance between two geometries
func (c *Calculator) CalculateDistance(wkt1, wkt2 string) (*DistanceMetrics, error) {
	distanceM, err := c.spatial.CalculateDistance(wkt1, wkt2)
	if err != nil {
		return nil, err
	}

	kilometers := distanceM.Div(decimal.NewFromInt(1000))
	miles := distanceM.Div(decimal.NewFromFloat(1609.34))

	return &DistanceMetrics{
		Meters:     distanceM,
		Kilometers: kilometers,
		Miles:      miles,
	}, nil
}

// BoundingBox represents a geographic bounding box
type BoundingBox struct {
	MinLat float64
	MaxLat float64
	MinLng float64
	MaxLng float64
	Width  float64 // in degrees
	Height float64 // in degrees
}

// CalculateBoundingBox calculates the bounding box of a geometry
func (c *Calculator) CalculateBoundingBox(wkt string) (*BoundingBox, error) {
	bboxWKT, err := c.spatial.CreateBoundingBox(wkt)
	if err != nil {
		return nil, err
	}

	// Parse bbox WKT (format: POLYGON((minLng minLat, maxLng minLat, maxLng maxLat, minLng maxLat, minLng minLat)))
	// This is a simplified parser - in production, use a proper WKT parser
	var minLng, minLat, maxLng, maxLat float64
	_, err = fmt.Sscanf(bboxWKT, "POLYGON((%f %f, %f %f, %f %f, %f %f, %f %f))",
		&minLng, &minLat, &maxLng, &minLat, &maxLng, &maxLat, &minLng, &maxLat, &minLng, &minLat)

	if err != nil {
		// Fallback: extract from envelope
		return nil, fmt.Errorf("failed to parse bounding box: %w", err)
	}

	return &BoundingBox{
		MinLat: minLat,
		MaxLat: maxLat,
		MinLng: minLng,
		MaxLng: maxLng,
		Width:  maxLng - minLng,
		Height: maxLat - minLat,
	}, nil
}

// CentroidPoint represents a centroid location
type CentroidPoint struct {
	Latitude  float64
	Longitude float64
	WKT       string
}

// CalculateCentroid calculates the centroid of a geometry
func (c *Calculator) CalculateCentroid(wkt string) (*CentroidPoint, error) {
	centroidWKT, err := c.spatial.CalculateCentroid(wkt)
	if err != nil {
		return nil, err
	}

	// Parse centroid WKT (format: POINT(lng lat))
	var lng, lat float64
	_, err = fmt.Sscanf(centroidWKT, "POINT(%f %f)", &lng, &lat)
	if err != nil {
		return nil, fmt.Errorf("failed to parse centroid: %w", err)
	}

	return &CentroidPoint{
		Latitude:  lat,
		Longitude: lng,
		WKT:       centroidWKT,
	}, nil
}

// OverlapMetrics contains overlap analysis results
type OverlapMetrics struct {
	Intersects          bool
	IntersectionArea    decimal.Decimal
	OverlapPercentage   float64
	OverlapPercentageOf float64 // Percentage relative to comparison geometry
}

// CalculateOverlap calculates overlap metrics between two geometries
func (c *Calculator) CalculateOverlap(wkt1, wkt2 string) (*OverlapMetrics, error) {
	// Check if they intersect
	intersects, err := c.spatial.CheckIntersection(wkt1, wkt2)
	if err != nil {
		return nil, err
	}

	if !intersects {
		return &OverlapMetrics{
			Intersects:          false,
			IntersectionArea:    decimal.Zero,
			OverlapPercentage:   0,
			OverlapPercentageOf: 0,
		}, nil
	}

	// Calculate intersection area
	intersectionArea, err := c.spatial.CalculateIntersectionArea(wkt1, wkt2)
	if err != nil {
		return nil, err
	}

	// Calculate original areas
	area1, err := c.spatial.CalculateArea(wkt1)
	if err != nil {
		return nil, err
	}

	area2, err := c.spatial.CalculateArea(wkt2)
	if err != nil {
		return nil, err
	}

	// Calculate percentages
	var overlapPct1, overlapPct2 float64
	if !area1.IsZero() {
		overlapPct1, _ = intersectionArea.Div(area1).Mul(decimal.NewFromInt(100)).Float64()
	}
	if !area2.IsZero() {
		overlapPct2, _ = intersectionArea.Div(area2).Mul(decimal.NewFromInt(100)).Float64()
	}

	return &OverlapMetrics{
		Intersects:          true,
		IntersectionArea:    intersectionArea.Div(decimal.NewFromInt(10000)), // Convert to hectares
		OverlapPercentage:   overlapPct1,
		OverlapPercentageOf: overlapPct2,
	}, nil
}

// CalculateHaversineDistance calculates distance using Haversine formula
// This is a simpler alternative to PostGIS for basic point-to-point distances
func (c *Calculator) CalculateHaversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusM = 6371000 // Earth's radius in meters

	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLng/2)*math.Sin(deltaLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusM * c
}

// CreateBuffer creates a buffer around a geometry
func (c *Calculator) CreateBuffer(wkt string, radiusMeters float64) (string, error) {
	return c.spatial.CreateBuffer(wkt, radiusMeters)
}

// CalculateCompactness calculates the compactness ratio (Polsby-Popper score)
// Score of 1.0 = perfect circle, lower scores = less compact
func (c *Calculator) CalculateCompactness(wkt string) (float64, error) {
	area, err := c.spatial.CalculateArea(wkt)
	if err != nil {
		return 0, err
	}

	perimeter, err := c.spatial.CalculatePerimeter(wkt)
	if err != nil {
		return 0, err
	}

	if perimeter.IsZero() {
		return 0, fmt.Errorf("perimeter is zero")
	}

	// Polsby-Popper formula: 4π × area / perimeter²
	areaFloat, _ := area.Float64()
	perimeterFloat, _ := perimeter.Float64()

	compactness := (4 * math.Pi * areaFloat) / (perimeterFloat * perimeterFloat)

	return compactness, nil
}
