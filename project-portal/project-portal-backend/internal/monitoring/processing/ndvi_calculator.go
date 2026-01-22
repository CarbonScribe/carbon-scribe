package processing

import (
	"errors"
	"math"
)

// VegetationIndices represents calculated vegetation indices from spectral bands
type VegetationIndices struct {
	NDVI float64 // Normalized Difference Vegetation Index
	EVI  float64 // Enhanced Vegetation Index
	SAVI float64 // Soil Adjusted Vegetation Index
	NDWI float64 // Normalized Difference Water Index
}

// SpectralBands represents the input spectral bands from satellite imagery
type SpectralBands struct {
	Red  float64 // Red band reflectance (typically 620-670 nm)
	NIR  float64 // Near-infrared band reflectance (typically 760-900 nm)
	Blue float64 // Blue band reflectance (typically 450-520 nm)
	SWIR float64 // Short-wave infrared band reflectance (typically 1550-1750 nm)
}

// NDVICalculator handles vegetation index calculations
type NDVICalculator struct{}

// NewNDVICalculator creates a new NDVI calculator instance
func NewNDVICalculator() *NDVICalculator {
	return &NDVICalculator{}
}

// CalculateNDVI computes the Normalized Difference Vegetation Index
// NDVI = (NIR - Red) / (NIR + Red)
// Range: -1 to 1, where higher values indicate healthier vegetation
func (c *NDVICalculator) CalculateNDVI(red, nir float64) (float64, error) {
	if red < 0 || nir < 0 {
		return 0, errors.New("spectral band values cannot be negative")
	}
	
	denominator := nir + red
	if denominator == 0 {
		return 0, nil
	}
	
	ndvi := (nir - red) / denominator
	
	// Clamp to valid range
	if ndvi < -1 {
		ndvi = -1
	} else if ndvi > 1 {
		ndvi = 1
	}
	
	return ndvi, nil
}

// CalculateEVI computes the Enhanced Vegetation Index
// EVI = G * ((NIR - Red) / (NIR + C1*Red - C2*Blue + L))
// where G=2.5, C1=6, C2=7.5, L=1 (standard coefficients)
// EVI is more sensitive to high biomass regions and reduces atmospheric effects
func (c *NDVICalculator) CalculateEVI(bands SpectralBands) (float64, error) {
	if bands.Red < 0 || bands.NIR < 0 || bands.Blue < 0 {
		return 0, errors.New("spectral band values cannot be negative")
	}
	
	const (
		G  = 2.5
		C1 = 6.0
		C2 = 7.5
		L  = 1.0
	)
	
	numerator := bands.NIR - bands.Red
	denominator := bands.NIR + C1*bands.Red - C2*bands.Blue + L
	
	if denominator == 0 {
		return 0, nil
	}
	
	evi := G * (numerator / denominator)
	
	// Clamp to reasonable range (-1 to 1)
	if evi < -1 {
		evi = -1
	} else if evi > 1 {
		evi = 1
	}
	
	return evi, nil
}

// CalculateSAVI computes the Soil Adjusted Vegetation Index
// SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L)
// where L is the soil brightness correction factor (typically 0.5)
// SAVI is useful in areas with sparse vegetation where soil background is visible
func (c *NDVICalculator) CalculateSAVI(red, nir float64, soilBrightnessFactor float64) (float64, error) {
	if red < 0 || nir < 0 {
		return 0, errors.New("spectral band values cannot be negative")
	}
	
	if soilBrightnessFactor < 0 || soilBrightnessFactor > 1 {
		return 0, errors.New("soil brightness factor must be between 0 and 1")
	}
	
	L := soilBrightnessFactor
	numerator := nir - red
	denominator := nir + red + L
	
	if denominator == 0 {
		return 0, nil
	}
	
	savi := (numerator / denominator) * (1 + L)
	
	// Clamp to valid range
	if savi < -1 {
		savi = -1
	} else if savi > 1 {
		savi = 1
	}
	
	return savi, nil
}

// CalculateNDWI computes the Normalized Difference Water Index
// NDWI = (NIR - SWIR) / (NIR + SWIR)
// NDWI is sensitive to water content in vegetation and soil moisture
func (c *NDVICalculator) CalculateNDWI(nir, swir float64) (float64, error) {
	if nir < 0 || swir < 0 {
		return 0, errors.New("spectral band values cannot be negative")
	}
	
	denominator := nir + swir
	if denominator == 0 {
		return 0, nil
	}
	
	ndwi := (nir - swir) / denominator
	
	// Clamp to valid range
	if ndwi < -1 {
		ndwi = -1
	} else if ndwi > 1 {
		ndwi = 1
	}
	
	return ndwi, nil
}

// CalculateAllIndices computes all vegetation indices from spectral bands
func (c *NDVICalculator) CalculateAllIndices(bands SpectralBands) (*VegetationIndices, error) {
	indices := &VegetationIndices{}
	
	// Calculate NDVI
	ndvi, err := c.CalculateNDVI(bands.Red, bands.NIR)
	if err != nil {
		return nil, err
	}
	indices.NDVI = ndvi
	
	// Calculate EVI (requires blue band)
	if bands.Blue > 0 {
		evi, err := c.CalculateEVI(bands)
		if err != nil {
			return nil, err
		}
		indices.EVI = evi
	}
	
	// Calculate SAVI (using default soil brightness factor of 0.5)
	savi, err := c.CalculateSAVI(bands.Red, bands.NIR, 0.5)
	if err != nil {
		return nil, err
	}
	indices.SAVI = savi
	
	// Calculate NDWI (if SWIR band is available)
	if bands.SWIR > 0 {
		ndwi, err := c.CalculateNDWI(bands.NIR, bands.SWIR)
		if err != nil {
			return nil, err
		}
		indices.NDWI = ndwi
	}
	
	return indices, nil
}

// AssessVegetationHealth provides a qualitative assessment based on NDVI value
func (c *NDVICalculator) AssessVegetationHealth(ndvi float64) string {
	switch {
	case ndvi < 0:
		return "water_or_snow"
	case ndvi >= 0 && ndvi < 0.2:
		return "bare_soil_or_rock"
	case ndvi >= 0.2 && ndvi < 0.3:
		return "sparse_vegetation"
	case ndvi >= 0.3 && ndvi < 0.5:
		return "moderate_vegetation"
	case ndvi >= 0.5 && ndvi < 0.7:
		return "healthy_vegetation"
	case ndvi >= 0.7:
		return "very_healthy_dense_vegetation"
	default:
		return "unknown"
	}
}

// CalculateDataQuality estimates data quality based on cloud coverage and other factors
func (c *NDVICalculator) CalculateDataQuality(cloudCoverage float64, atmosphericConditions string) float64 {
	// Start with base quality score
	quality := 1.0
	
	// Reduce quality based on cloud coverage
	if cloudCoverage > 0 {
		cloudPenalty := cloudCoverage / 100.0
		quality -= cloudPenalty * 0.8 // Cloud coverage has major impact
	}
	
	// Adjust for atmospheric conditions
	switch atmosphericConditions {
	case "excellent":
		// No adjustment
	case "good":
		quality -= 0.05
	case "fair":
		quality -= 0.15
	case "poor":
		quality -= 0.3
	case "very_poor":
		quality -= 0.5
	}
	
	// Ensure quality is in valid range [0, 1]
	if quality < 0 {
		quality = 0
	} else if quality > 1 {
		quality = 1
	}
	
	return math.Round(quality*100) / 100 // Round to 2 decimal places
}

// ValidateBands checks if spectral band values are within reasonable ranges
func (c *NDVICalculator) ValidateBands(bands SpectralBands) error {
	// Typical reflectance values should be between 0 and 1 (or 0-100% if scaled)
	if bands.Red < 0 || bands.Red > 1 {
		return errors.New("red band value out of valid range (0-1)")
	}
	if bands.NIR < 0 || bands.NIR > 1 {
		return errors.New("NIR band value out of valid range (0-1)")
	}
	if bands.Blue < 0 || bands.Blue > 1 {
		return errors.New("blue band value out of valid range (0-1)")
	}
	if bands.SWIR < 0 || bands.SWIR > 1 {
		return errors.New("SWIR band value out of valid range (0-1)")
	}
	
	return nil
}
