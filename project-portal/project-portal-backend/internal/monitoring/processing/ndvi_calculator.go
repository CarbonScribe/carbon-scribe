 package processing

import (
    "context"
    "errors"
    "math"
    "time"
)

const ndviZeroGuard = 1e-12

// NDVIResult holds NDVI pixel values, raster dimensions, computed summary
// statistics, and metadata for downstream persistence.
type NDVIResult struct {
    Pixels     []float64 `json:"pixels"`
    Width      int       `json:"width,omitempty"`
    Height     int       `json:"height,omitempty"`
    PixelCount int       `json:"pixel_count,omitempty"`
    Min        float64   `json:"min"`
    Max        float64   `json:"max"`
    Mean       float64   `json:"mean"`
    ProjectID  string    `json:"project_id"`
    Timestamp  time.Time `json:"timestamp"`
}

// NDVIPersister is an internal persistence contract for storing NDVI results.
type NDVIPersister interface {
    SaveNDVI(ctx context.Context, result NDVIResult) error
}

// PersistNDVI persists an NDVI result through a provided persister.
func PersistNDVI(ctx context.Context, persister NDVIPersister, result NDVIResult) error {
    if persister == nil {
        return errors.New("ndvi persister cannot be nil")
    }
    return persister.SaveNDVI(ctx, result)
}

// ValidateBandData checks one-dimensional NIR and RED bands for shape validity.
func ValidateBandData(nir, red []float64) error {
    if nir == nil || red == nil {
        return errors.New("nir and red slices must not be nil")
    }
    if len(nir) == 0 || len(red) == 0 {
        return errors.New("nir and red slices must not be empty")
    }
    if len(nir) != len(red) {
        return errors.New("nir and red slices must have equal length")
    }
    return nil
}

// ValidateRasterBands checks two-dimensional NIR and RED raster bands for shape validity.
func ValidateRasterBands(nir, red [][]float64) error {
    if nir == nil || red == nil {
        return errors.New("nir and red raster bands must not be nil")
    }
    if len(nir) == 0 || len(red) == 0 {
        return errors.New("nir and red raster bands must not be empty")
    }
    if len(nir) != len(red) {
        return errors.New("nir and red raster bands must have the same height")
    }

    width := -1
    for row := range nir {
        if nir[row] == nil || red[row] == nil {
            return errors.New("nir and red raster rows must not be nil")
        }
        if width < 0 {
            width = len(nir[row])
            if width == 0 {
                return errors.New("nir and red raster rows must not be empty")
            }
        }
        if len(nir[row]) != width || len(red[row]) != width {
            return errors.New("nir and red raster rows must have the same width")
        }
    }
    return nil
}

// ComputeNDVI computes NDVI per-pixel from 1D NIR and RED bands.
// NDVI formula: (NIR - RED) / (NIR + RED).
func ComputeNDVI(nir, red []float64) ([]float64, error) {
    if err := ValidateBandData(nir, red); err != nil {
        return nil, err
    }

    out := make([]float64, len(nir))
    for i := range nir {
        out[i] = computeNDVIValue(nir[i], red[i])
    }
    return out, nil
}

// ComputeNDVIFromRaster computes NDVI per-pixel from 2D NIR and RED raster bands.
func ComputeNDVIFromRaster(nir, red [][]float64) ([][]float64, error) {
    if err := ValidateRasterBands(nir, red); err != nil {
        return nil, err
    }

    height := len(nir)
    width := len(nir[0])
    out := make([][]float64, height)
    for y := 0; y < height; y++ {
        out[y] = make([]float64, width)
        for x := 0; x < width; x++ {
            out[y][x] = computeNDVIValue(nir[y][x], red[y][x])
        }
    }
    return out, nil
}

func computeNDVIValue(nir, red float64) float64 {
    sum := nir + red
    if math.IsNaN(sum) || math.IsInf(sum, 0) || math.Abs(sum) <= ndviZeroGuard {
        return 0.0
    }

    ndvi := (nir - red) / sum
    if math.IsNaN(ndvi) || math.IsInf(ndvi, 0) {
        return 0.0
    }
    return ndvi
}

func flattenRaster(raster [][]float64) []float64 {
    if len(raster) == 0 {
        return nil
    }

    height := len(raster)
    width := len(raster[0])
    out := make([]float64, 0, height*width)
    for y := 0; y < height; y++ {
        out = append(out, raster[y]...)
    }
    return out
}

// SummaryNDVI computes min, max and mean for a slice of NDVI values.
// Returns zeros for empty input.
func SummaryNDVI(values []float64) (min, max, mean float64) {
    if len(values) == 0 {
        return 0, 0, 0
    }

    min = math.Inf(1)
    max = math.Inf(-1)
    var sum float64
    for _, v := range values {
        if v < min {
            min = v
        }
        if v > max {
            max = v
        }
        sum += v
    }
    mean = sum / float64(len(values))
    return min, max, mean
}

// NewNDVIResult constructs an NDVIResult with computed summary stats and metadata.
// If width or height are invalid, the result defaults to a 1D raster.
func NewNDVIResult(pixels []float64, width, height int, projectID string, ts time.Time) NDVIResult {
    if width <= 0 || height <= 0 || width*height != len(pixels) {
        width = len(pixels)
        height = 1
    }

    min, max, mean := SummaryNDVI(pixels)
    return NDVIResult{
        Pixels:     pixels,
        Width:      width,
        Height:     height,
        PixelCount: len(pixels),
        Min:        min,
        Max:        max,
        Mean:       mean,
        ProjectID:  projectID,
        Timestamp:  ts,
    }
}

// NewNDVIResultFromRaster computes an NDVI result from 2D NIR and RED raster bands.
func NewNDVIResultFromRaster(nir, red [][]float64, projectID string, ts time.Time) (NDVIResult, error) {
    pixels2D, err := ComputeNDVIFromRaster(nir, red)
    if err != nil {
        return NDVIResult{}, err
    }

    pixels := flattenRaster(pixels2D)
    return NewNDVIResult(pixels, len(nir[0]), len(nir), projectID, ts), nil
}

// MockPersistenceOutline shows a structural example of how results could be persisted.
// This does NOT perform real persistence; it's a small helper that demonstrates
// building the NDVIResult with a mock Project ID and Timestamp.
func MockPersistenceOutline(nir, red []float64) (NDVIResult, error) {
    pixels, err := ComputeNDVI(nir, red)
    if err != nil {
        return NDVIResult{}, err
    }

    res := NewNDVIResult(pixels, len(pixels), 1, "mock-project-123", time.Now().UTC())
    return res, nil
}

