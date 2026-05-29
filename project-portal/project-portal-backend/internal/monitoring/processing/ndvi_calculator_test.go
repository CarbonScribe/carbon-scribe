package processing

import (
	"math"
	"testing"
	"time"
)

// approxEqual compares floats with a small tolerance.
func approxEqual(a, b, tol float64) bool {
	return math.Abs(a-b) <= tol
}

func TestComputeNDVI_Table(t *testing.T) {
	tests := []struct {
		name     string
		nir      []float64
		red      []float64
		want     []float64
		wantErr  bool
		wantMin  float64
		wantMax  float64
		wantMean float64
	}{
		{
			name:     "happy path",
			nir:      []float64{0.6, 0.8, 0.0},
			red:      []float64{0.2, 0.1, 0.0},
			want:     []float64{0.5, 0.7777777777777778, 0.0},
			wantErr:  false,
			wantMin:  0.0,
			wantMax:  0.7777777777777778,
			wantMean: (0.5 + 0.7777777777777778 + 0.0) / 3.0,
		},
		{
			name:    "mismatched lengths",
			nir:     []float64{0.1},
			red:     []float64{0.1, 0.2},
			wantErr: true,
		},
		{
			name:    "empty slices",
			nir:     []float64{},
			red:     []float64{},
			wantErr: true,
		},
		{
			name:     "all zeros division-by-zero guard",
			nir:      []float64{0.0, 0.0, 0.0},
			red:      []float64{0.0, 0.0, 0.0},
			want:     []float64{0.0, 0.0, 0.0},
			wantErr:  false,
			wantMin:  0.0,
			wantMax:  0.0,
			wantMean: 0.0,
		},
		{
			name:     "negative vegetation index",
			nir:      []float64{0.1, 0.2},
			red:      []float64{0.3, 0.4},
			want:     []float64{-0.5, -0.3333333333333333},
			wantErr:  false,
			wantMin:  -0.5,
			wantMax:  -0.3333333333333333,
			wantMean: (-0.5 + -0.3333333333333333) / 2.0,
		},
		{
			name:    "invalid numeric values produce zeros",
			nir:     []float64{math.NaN(), 1.0},
			red:     []float64{0.1, math.Inf(1)},
			want:    []float64{0.0, 0.0},
			wantErr: false,
			wantMin: 0.0,
			wantMax: 0.0,
			wantMean: 0.0,
		},
	}

	tol := 1e-9
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ComputeNDVI(tc.nir, tc.red)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error but got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(got) != len(tc.want) {
				t.Fatalf("length mismatch: got %d want %d", len(got), len(tc.want))
			}

			for i := range got {
				if !approxEqual(got[i], tc.want[i], tol) {
					t.Fatalf("index %d: got %v want %v", i, got[i], tc.want[i])
				}
			}

			res := NewNDVIResult(got, len(got), 1, "test-project", time.Now())
			if !approxEqual(res.Min, tc.wantMin, tol) {
				t.Fatalf("min mismatch: got %v want %v", res.Min, tc.wantMin)
			}
			if !approxEqual(res.Max, tc.wantMax, tol) {
				t.Fatalf("max mismatch: got %v want %v", res.Max, tc.wantMax)
			}
			if !approxEqual(res.Mean, tc.wantMean, tol) {
				t.Fatalf("mean mismatch: got %v want %v", res.Mean, tc.wantMean)
			}
			if res.PixelCount != len(got) {
				t.Fatalf("pixel count mismatch: got %d want %d", res.PixelCount, len(got))
			}
		})
	}
}

func TestComputeNDVIFromRaster(t *testing.T) {
	nir := [][]float64{
		{0.6, 0.8},
		{0.2, 0.0},
	}
	red := [][]float64{
		{0.2, 0.1},
		{0.2, 0.0},
	}
	want := [][]float64{
		{0.5, 0.7777777777777778},
		{0.0, 0.0},
	}

	got, err := ComputeNDVIFromRaster(nir, red)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(got) != len(want) {
		t.Fatalf("height mismatch: got %d want %d", len(got), len(want))
	}

	for y := range got {
		if len(got[y]) != len(want[y]) {
			t.Fatalf("width mismatch at row %d: got %d want %d", y, len(got[y]), len(want[y]))
		}
		for x := range got[y] {
			if !approxEqual(got[y][x], want[y][x], 1e-9) {
				t.Fatalf("pixel [%d][%d] = %v want %v", y, x, got[y][x], want[y][x])
			}
		}
	}
}

func TestNewNDVIResultFromRaster(t *testing.T) {
	nir := [][]float64{{0.5, 0.5}, {0.3, 0.1}}
	red := [][]float64{{0.1, 0.1}, {0.2, 0.0}}

	res, err := NewNDVIResultFromRaster(nir, red, "project-1", time.Date(2026, 5, 28, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Width != 2 || res.Height != 2 || res.PixelCount != 4 {
		t.Fatalf("unexpected dimensions: %dx%d count=%d", res.Width, res.Height, res.PixelCount)
	}
	if res.ProjectID != "project-1" {
		t.Fatalf("unexpected project id: %s", res.ProjectID)
	}
	if !res.Timestamp.Equal(time.Date(2026, 5, 28, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected timestamp: %v", res.Timestamp)
	}
	if res.Min >= res.Max {
		t.Fatalf("expected min < max, got min=%v max=%v", res.Min, res.Max)
	}
}

func TestValidateRasterBands_Errors(t *testing.T) {
	tests := []struct {
		name string
		nir  [][]float64
		red  [][]float64
	}{
		{
			name: "mismatched height",
			nir:  [][]float64{{0.1}},
			red:  [][]float64{{0.1}, {0.2}},
		},
		{
			name: "row width mismatch",
			nir:  [][]float64{{0.1, 0.2}},
			red:  [][]float64{{0.1}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateRasterBands(tc.nir, tc.red); err == nil {
				t.Fatalf("expected validation error for %s", tc.name)
			}
		})
	}
}
