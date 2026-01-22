package ingestion

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring/processing"

	"github.com/google/uuid"
)

// SatelliteIngestion handles satellite data ingestion and processing
type SatelliteIngestion struct {
	repo              monitoring.Repository
	ndviCalculator    *processing.NDVICalculator
	biomassEstimator  *processing.BiomassEstimator
}

// NewSatelliteIngestion creates a new satellite ingestion handler
func NewSatelliteIngestion(repo monitoring.Repository) *SatelliteIngestion {
	return &SatelliteIngestion{
		repo:             repo,
		ndviCalculator:   processing.NewNDVICalculator(),
		biomassEstimator: processing.NewBiomassEstimator(),
	}
}

// ProcessWebhook processes incoming satellite data from webhook
func (s *SatelliteIngestion) ProcessWebhook(ctx context.Context, payload monitoring.SatelliteWebhookPayload) error {
	// Validate payload
	if err := s.validateWebhookPayload(payload); err != nil {
		return fmt.Errorf("invalid webhook payload: %w", err)
	}

	// Extract spectral bands
	bands, err := s.extractSpectralBands(payload.Bands)
	if err != nil {
		return fmt.Errorf("failed to extract spectral bands: %w", err)
	}

	// Validate bands
	if err := s.ndviCalculator.ValidateBands(bands); err != nil {
		return fmt.Errorf("invalid spectral bands: %w", err)
	}

	// Calculate vegetation indices
	indices, err := s.ndviCalculator.CalculateAllIndices(bands)
	if err != nil {
		return fmt.Errorf("failed to calculate vegetation indices: %w", err)
	}

	// Infer vegetation type if not provided
	vegetationType := s.biomassEstimator.InferVegetationType(indices.NDVI, indices.EVI, indices.SAVI)

	// Estimate biomass
	biomassEstimate, err := s.biomassEstimator.EstimateFromMultipleIndices(indices, vegetationType)
	if err != nil {
		return fmt.Errorf("failed to estimate biomass: %w", err)
	}

	// Validate biomass estimate
	if err := s.biomassEstimator.ValidateBiomassEstimate(biomassEstimate); err != nil {
		return fmt.Errorf("invalid biomass estimate: %w", err)
	}

	// Calculate data quality
	dataQuality := s.ndviCalculator.CalculateDataQuality(payload.CloudCover, "good")

	// Convert geometry to appropriate format
	geometryStr, err := s.convertGeometry(payload.Geometry)
	if err != nil {
		return fmt.Errorf("failed to convert geometry: %w", err)
	}

	// Create satellite observation record
	observation := &monitoring.SatelliteObservation{
		Time:                 payload.AcquisitionTime,
		ProjectID:            s.getOrInferProjectID(payload.ProjectID, geometryStr),
		SatelliteSource:      payload.Source,
		TileID:               &payload.TileID,
		NDVI:                 &indices.NDVI,
		EVI:                  &indices.EVI,
		SAVI:                 &indices.SAVI,
		NDWI:                 &indices.NDWI,
		BiomassKgPerHa:       &biomassEstimate.BiomassKgPerHa,
		CloudCoveragePercent: &payload.CloudCover,
		DataQualityScore:     &dataQuality,
		Geometry:             geometryStr,
		RawBands:             s.convertToJSONB(payload.Bands),
		Metadata:             s.enrichMetadata(payload.Metadata, biomassEstimate, vegetationType),
		CreatedAt:            time.Now(),
	}

	// Store in database
	if err := s.repo.CreateSatelliteObservation(ctx, observation); err != nil {
		return fmt.Errorf("failed to store satellite observation: %w", err)
	}

	return nil
}

// ProcessBatch processes multiple satellite observations in batch
func (s *SatelliteIngestion) ProcessBatch(ctx context.Context, payloads []monitoring.SatelliteWebhookPayload) error {
	observations := make([]monitoring.SatelliteObservation, 0, len(payloads))

	for _, payload := range payloads {
		// Process each payload
		bands, err := s.extractSpectralBands(payload.Bands)
		if err != nil {
			continue // Skip invalid data
		}

		indices, err := s.ndviCalculator.CalculateAllIndices(bands)
		if err != nil {
			continue
		}

		vegetationType := s.biomassEstimator.InferVegetationType(indices.NDVI, indices.EVI, indices.SAVI)
		biomassEstimate, err := s.biomassEstimator.EstimateFromMultipleIndices(indices, vegetationType)
		if err != nil {
			continue
		}

		dataQuality := s.ndviCalculator.CalculateDataQuality(payload.CloudCover, "good")
		geometryStr, _ := s.convertGeometry(payload.Geometry)

		observation := monitoring.SatelliteObservation{
			Time:                 payload.AcquisitionTime,
			ProjectID:            s.getOrInferProjectID(payload.ProjectID, geometryStr),
			SatelliteSource:      payload.Source,
			TileID:               &payload.TileID,
			NDVI:                 &indices.NDVI,
			EVI:                  &indices.EVI,
			SAVI:                 &indices.SAVI,
			NDWI:                 &indices.NDWI,
			BiomassKgPerHa:       &biomassEstimate.BiomassKgPerHa,
			CloudCoveragePercent: &payload.CloudCover,
			DataQualityScore:     &dataQuality,
			Geometry:             geometryStr,
			RawBands:             s.convertToJSONB(payload.Bands),
			Metadata:             s.enrichMetadata(payload.Metadata, biomassEstimate, vegetationType),
			CreatedAt:            time.Now(),
		}

		observations = append(observations, observation)
	}

	if len(observations) == 0 {
		return errors.New("no valid observations to process")
	}

	// Batch insert
	return s.repo.CreateSatelliteObservationBatch(ctx, observations)
}

// validateWebhookPayload validates the incoming webhook payload
func (s *SatelliteIngestion) validateWebhookPayload(payload monitoring.SatelliteWebhookPayload) error {
	if payload.Source == "" {
		return errors.New("satellite source is required")
	}

	if payload.TileID == "" {
		return errors.New("tile ID is required")
	}

	if payload.AcquisitionTime.IsZero() {
		return errors.New("acquisition time is required")
	}

	if payload.Bands == nil || len(payload.Bands) == 0 {
		return errors.New("spectral bands are required")
	}

	// Validate cloud cover range
	if payload.CloudCover < 0 || payload.CloudCover > 100 {
		return errors.New("cloud cover must be between 0 and 100")
	}

	return nil
}

// extractSpectralBands extracts spectral band values from the payload
func (s *SatelliteIngestion) extractSpectralBands(bands map[string]float64) (processing.SpectralBands, error) {
	spectralBands := processing.SpectralBands{}

	// Extract required bands (different satellites use different naming conventions)
	if red, ok := bands["red"]; ok {
		spectralBands.Red = red
	} else if red, ok := bands["B4"]; ok { // Sentinel-2 naming
		spectralBands.Red = red
	} else if red, ok := bands["band4"]; ok { // Landsat naming
		spectralBands.Red = red
	} else {
		return spectralBands, errors.New("red band not found")
	}

	if nir, ok := bands["nir"]; ok {
		spectralBands.NIR = nir
	} else if nir, ok := bands["B8"]; ok { // Sentinel-2 naming
		spectralBands.NIR = nir
	} else if nir, ok := bands["band5"]; ok { // Landsat naming
		spectralBands.NIR = nir
	} else {
		return spectralBands, errors.New("NIR band not found")
	}

	// Optional bands
	if blue, ok := bands["blue"]; ok {
		spectralBands.Blue = blue
	} else if blue, ok := bands["B2"]; ok {
		spectralBands.Blue = blue
	} else if blue, ok := bands["band2"]; ok {
		spectralBands.Blue = blue
	}

	if swir, ok := bands["swir"]; ok {
		spectralBands.SWIR = swir
	} else if swir, ok := bands["B11"]; ok {
		spectralBands.SWIR = swir
	} else if swir, ok := bands["band6"]; ok {
		spectralBands.SWIR = swir
	}

	return spectralBands, nil
}

// convertGeometry converts geometry from various formats to PostGIS-compatible format
func (s *SatelliteIngestion) convertGeometry(geometry interface{}) (*string, error) {
	if geometry == nil {
		return nil, nil
	}

	// Convert to JSON string for now (PostGIS can handle GeoJSON)
	geoJSON, err := json.Marshal(geometry)
	if err != nil {
		return nil, err
	}

	geoStr := string(geoJSON)
	return &geoStr, nil
}

// getOrInferProjectID gets project ID from payload or infers from geometry
func (s *SatelliteIngestion) getOrInferProjectID(projectID *uuid.UUID, geometry *string) uuid.UUID {
	if projectID != nil {
		return *projectID
	}

	// TODO: Implement spatial lookup to find project based on geometry intersection
	// For now, return a zero UUID (should be handled by validation in production)
	return uuid.Nil
}

// convertToJSONB converts map to JSONB type
func (s *SatelliteIngestion) convertToJSONB(data map[string]float64) monitoring.JSONB {
	jsonb := make(monitoring.JSONB)
	for k, v := range data {
		jsonb[k] = v
	}
	return jsonb
}

// enrichMetadata adds additional metadata to the observation
func (s *SatelliteIngestion) enrichMetadata(
	metadata map[string]interface{},
	biomassEstimate *processing.BiomassEstimate,
	vegetationType string,
) monitoring.JSONB {
	enriched := make(monitoring.JSONB)

	// Copy existing metadata
	for k, v := range metadata {
		enriched[k] = v
	}

	// Add processing metadata
	enriched["vegetation_type"] = vegetationType
	enriched["biomass_estimation_method"] = biomassEstimate.Method
	enriched["biomass_confidence"] = biomassEstimate.ConfidenceScore
	enriched["carbon_tonnes_per_ha"] = biomassEstimate.CarbonTonnesPerHa
	enriched["processed_at"] = time.Now().Format(time.RFC3339)
	enriched["processor_version"] = "1.0.0"

	return enriched
}

// GetLatestObservation retrieves the latest satellite observation for a project
func (s *SatelliteIngestion) GetLatestObservation(ctx context.Context, projectID uuid.UUID, source string) (*monitoring.SatelliteObservation, error) {
	return s.repo.GetLatestSatelliteObservation(ctx, projectID, source)
}

// FilterCloudyObservations filters out observations with high cloud coverage
func (s *SatelliteIngestion) FilterCloudyObservations(observations []monitoring.SatelliteObservation, maxCloudCover float64) []monitoring.SatelliteObservation {
	filtered := make([]monitoring.SatelliteObservation, 0, len(observations))

	for _, obs := range observations {
		if obs.CloudCoveragePercent == nil || *obs.CloudCoveragePercent <= maxCloudCover {
			filtered = append(filtered, obs)
		}
	}

	return filtered
}

// CalculateAverageNDVI calculates average NDVI for a project over a time period
func (s *SatelliteIngestion) CalculateAverageNDVI(ctx context.Context, projectID uuid.UUID, start, end time.Time) (float64, error) {
	return s.repo.CalculateAverageNDVI(ctx, projectID, start, end)
}
