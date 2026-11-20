import turfArea from '@turf/area';

// ============================================================================
// Constants
// ============================================================================

/** Default area tolerance threshold (10%) */
export const DEFAULT_AREA_TOLERANCE = 0.10;

/** Minimum polygon area in hectares (0.01 ha = 100 m²) */
export const MIN_POLYGON_AREA_HA = 0.01;

/** Maximum polygon area in hectares (5,000,000 ha) */
export const MAX_POLYGON_AREA_HA = 5_000_000;

// ============================================================================
// Interfaces
// ============================================================================

export interface AreaDivergenceResult {
  /** Calculated real-world area in hectares */
  calculatedArea: number;
  /** Expected / recorded project area in hectares (if provided) */
  expectedArea?: number;
  /** Absolute difference between calculated and expected area in hectares */
  diffHectares: number;
  /** Relative difference expressed as a percentage (e.g. 15.5 for 15.5%) */
  divergencePercent: number;
  /** True if divergence exceeds the configured tolerance */
  isDivergent: boolean;
  /** Configured tolerance threshold (e.g. 0.10 for 10%) */
  tolerance: number;
  /** Human-readable warning message if divergent */
  warning?: string;
}

export interface PolygonValidationResult {
  valid: boolean;
  error?: string;
  areaHectares?: number;
}

// ============================================================================
// Calculation Utilities
// ============================================================================

/**
 * Calculate the real-world geodesic area of a GeoJSON geometry in square meters
 * using @turf/area on the WGS84 ellipsoid.
 */
export function calculateGeoJSONAreaSquareMeters(geometry: any): number {
  if (!geometry) return 0;
  try {
    const areaM2 = turfArea(geometry as any);
    return isNaN(areaM2) || areaM2 < 0 ? 0 : areaM2;
  } catch {
    return 0;
  }
}

/**
 * Calculate the real-world geodesic area of a GeoJSON geometry in hectares.
 * 1 hectare = 10,000 m².
 * @param geometry GeoJSON geometry, Feature, or FeatureCollection
 * @param decimals Number of decimal places to round to (default: 2)
 */
export function calculateGeoJSONAreaHectares(
  geometry: any,
  decimals = 2
): number {
  const sqMeters = calculateGeoJSONAreaSquareMeters(geometry);
  const hectares = sqMeters / 10_000;
  const factor = Math.pow(10, decimals);
  return Math.round(hectares * factor) / factor;
}

/**
 * Compare computed polygon area in hectares against project's stored area field.
 * Flags divergence if relative difference exceeds tolerance (default: 10%).
 *
 * @param geometry GeoJSON geometry representing the project boundary
 * @param expectedArea Project's stored area in hectares (from project record)
 * @param tolerance Fraction tolerance (default: 0.10 for 10%)
 */
export function validateProjectAreaDivergence(
  geometry: any,
  expectedArea?: number | null,
  tolerance: number = DEFAULT_AREA_TOLERANCE
): AreaDivergenceResult {
  const calculatedArea = calculateGeoJSONAreaHectares(geometry);

  // If no expected area was provided or expected area is 0 or negative
  if (expectedArea == null || expectedArea <= 0 || isNaN(expectedArea)) {
    return {
      calculatedArea,
      expectedArea: expectedArea ?? undefined,
      diffHectares: 0,
      divergencePercent: 0,
      isDivergent: false,
      tolerance,
      warning: undefined,
    };
  }

  const diffHectares = Math.round(Math.abs(calculatedArea - expectedArea) * 100) / 100;
  const divergenceRatio = diffHectares / expectedArea;
  const divergencePercent = Math.round(divergenceRatio * 1000) / 10;
  const isDivergent = divergenceRatio > tolerance;

  let warning: string | undefined;
  if (isDivergent) {
    const tolerancePercent = Math.round(tolerance * 100);
    warning = `Area mismatch warning: Boundary area is ${calculatedArea.toLocaleString()} ha, which diverges by ${divergencePercent}% from declared project area of ${expectedArea.toLocaleString()} ha (tolerance: ±${tolerancePercent}%).`;
  }

  return {
    calculatedArea,
    expectedArea,
    diffHectares,
    divergencePercent,
    isDivergent,
    tolerance,
    warning,
  };
}

// ============================================================================
// Polygon Validation
// ============================================================================

/**
 * Check if a polygon's boundary self-intersects.
 */
export function hasSelfIntersection(coordinates: number[][]): boolean {
  const n = coordinates.length;
  if (n < 4) return false;

  const direction = (p1: number[], p2: number[], p3: number[]): number => {
    return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
  };

  const segmentsIntersect = (
    p1: number[],
    p2: number[],
    p3: number[],
    p4: number[]
  ): boolean => {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);

    if (
      ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    ) {
      return true;
    }

    return false;
  };

  // Check each pair of non-adjacent segments
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;

      if (
        segmentsIntersect(
          coordinates[i],
          coordinates[(i + 1) % n],
          coordinates[j],
          coordinates[(j + 1) % n]
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate a polygon geometry for structural correctness and area limits.
 */
export function validatePolygon(geometry: any): PolygonValidationResult {
  if (!geometry || geometry.type !== 'Polygon') {
    return { valid: false, error: 'Only polygon geometries are allowed' };
  }

  const polygon = geometry as GeoJSON.Polygon;
  if (!polygon.coordinates || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    return { valid: false, error: 'Polygon must have coordinate rings' };
  }

  const coordinates = polygon.coordinates[0];
  if (!coordinates || coordinates.length < 4) {
    return { valid: false, error: 'Polygon must have at least 4 points (3 + closing point)' };
  }

  // Check if first and last points match (closed polygon)
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    return { valid: false, error: 'Polygon must be closed (first and last points must match)' };
  }

  // Check for self-intersection
  if (hasSelfIntersection(coordinates)) {
    return { valid: false, error: 'Polygon cannot self-intersect' };
  }

  // Calculate real geodesic area
  const areaHectares = calculateGeoJSONAreaHectares(geometry);

  if (areaHectares < MIN_POLYGON_AREA_HA) {
    return {
      valid: false,
      error: `Polygon area is too small (minimum ${MIN_POLYGON_AREA_HA} hectares)`,
      areaHectares,
    };
  }

  if (areaHectares > MAX_POLYGON_AREA_HA) {
    return {
      valid: false,
      error: `Polygon area is too large (maximum ${MAX_POLYGON_AREA_HA.toLocaleString()} hectares)`,
      areaHectares,
    };
  }

  return { valid: true, areaHectares };
}

/**
 * Extract a Polygon geometry from an arbitrary GeoJSON object
 * (supports raw Polygon, Feature containing Polygon, or FeatureCollection).
 */
export function extractPolygonFromGeoJSON(data: any): GeoJSON.Polygon | null {
  if (!data) return null;
  if (data.type === 'Polygon' && Array.isArray(data.coordinates)) {
    return data as GeoJSON.Polygon;
  }
  if (data.type === 'Feature' && data.geometry?.type === 'Polygon') {
    return data.geometry as GeoJSON.Polygon;
  }
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    const polyFeature = data.features.find(
      (f: any) => f?.geometry?.type === 'Polygon' && Array.isArray(f.geometry.coordinates)
    );
    if (polyFeature?.geometry) {
      return polyFeature.geometry as GeoJSON.Polygon;
    }
  }
  return null;
}
