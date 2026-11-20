import { describe, it, expect } from 'vitest';
import {
  calculateGeoJSONAreaSquareMeters,
  calculateGeoJSONAreaHectares,
  validateProjectAreaDivergence,
  validatePolygon,
  extractPolygonFromGeoJSON,
  hasSelfIntersection,
  DEFAULT_AREA_TOLERANCE,
} from './areaValidation';

describe('areaValidation - calculateGeoJSONAreaSquareMeters & calculateGeoJSONAreaHectares', () => {
  it('returns 0 for null or undefined geometry', () => {
    expect(calculateGeoJSONAreaSquareMeters(null)).toBe(0);
    expect(calculateGeoJSONAreaSquareMeters(undefined)).toBe(0);
    expect(calculateGeoJSONAreaHectares(null)).toBe(0);
    expect(calculateGeoJSONAreaHectares(undefined)).toBe(0);
  });

  it('calculates real-world area of a known polygon', () => {
    // 0.01 x 0.01 degree box at equator (~1.11 km x 1.11 km ≈ 123 ha)
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0.01, 0],
          [0.01, 0.01],
          [0, 0.01],
          [0, 0],
        ],
      ],
    };

    const sqMeters = calculateGeoJSONAreaSquareMeters(polygon);
    const hectares = calculateGeoJSONAreaHectares(polygon);

    expect(sqMeters).toBeGreaterThan(1_200_000);
    expect(sqMeters).toBeLessThan(1_300_000);
    expect(hectares).toBeCloseTo(sqMeters / 10_000, 2);
    expect(hectares).toBeGreaterThan(120);
    expect(hectares).toBeLessThan(130);
  });

  it('calculates area for GeoJSON Feature and FeatureCollection', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [10, 10],
          [10.01, 10],
          [10.01, 10.01],
          [10, 10.01],
          [10, 10],
        ],
      ],
    };
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: polygon,
    };
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [feature],
    };

    const polyArea = calculateGeoJSONAreaHectares(polygon);
    const featureArea = calculateGeoJSONAreaHectares(feature);
    const collectionArea = calculateGeoJSONAreaHectares(collection);

    expect(featureArea).toBe(polyArea);
    expect(collectionArea).toBe(polyArea);
  });
});

describe('areaValidation - validateProjectAreaDivergence', () => {
  // A polygon of ~123.64 hectares
  const samplePolygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ],
    ],
  };

  it('handles null, zero, or negative expectedArea without flagging divergence', () => {
    const resNull = validateProjectAreaDivergence(samplePolygon, null);
    expect(resNull.isDivergent).toBe(false);
    expect(resNull.warning).toBeUndefined();
    expect(resNull.calculatedArea).toBeGreaterThan(120);

    const resZero = validateProjectAreaDivergence(samplePolygon, 0);
    expect(resZero.isDivergent).toBe(false);

    const resNeg = validateProjectAreaDivergence(samplePolygon, -50);
    expect(resNeg.isDivergent).toBe(false);
  });

  it('accepts boundary area matching recorded area within tolerance (<= 10%)', () => {
    const calculatedArea = calculateGeoJSONAreaHectares(samplePolygon); // ~123.64 ha

    // Exactly matching
    const resExact = validateProjectAreaDivergence(samplePolygon, calculatedArea);
    expect(resExact.isDivergent).toBe(false);
    expect(resExact.divergencePercent).toBe(0);
    expect(resExact.warning).toBeUndefined();

    // 5% difference (within 10% tolerance)
    const expectedWithin = calculatedArea * 1.05;
    const resWithin = validateProjectAreaDivergence(samplePolygon, expectedWithin);
    expect(resWithin.isDivergent).toBe(false);
    expect(resWithin.divergencePercent).toBeCloseTo(4.8, 1);
    expect(resWithin.warning).toBeUndefined();
  });

  it('flags divergence and provides warning when boundary exceeds recorded area by > 10%', () => {
    const calculatedArea = calculateGeoJSONAreaHectares(samplePolygon); // ~123.64 ha
    const declaredArea = 80; // Boundary is ~54% larger than 80 ha

    const result = validateProjectAreaDivergence(samplePolygon, declaredArea, DEFAULT_AREA_TOLERANCE);

    expect(result.isDivergent).toBe(true);
    expect(result.calculatedArea).toBe(calculatedArea);
    expect(result.expectedArea).toBe(declaredArea);
    expect(result.divergencePercent).toBeGreaterThan(50);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('Area mismatch warning');
    expect(result.warning).toContain(`${declaredArea} ha`);
    expect(result.warning).toContain('tolerance: ±10%');
  });

  it('flags divergence when boundary is much smaller than recorded area by > 10%', () => {
    const calculatedArea = calculateGeoJSONAreaHectares(samplePolygon); // ~123.64 ha
    const declaredArea = 250; // Boundary is ~50% smaller than 250 ha

    const result = validateProjectAreaDivergence(samplePolygon, declaredArea, 0.10);

    expect(result.isDivergent).toBe(true);
    expect(result.divergencePercent).toBeGreaterThan(45);
    expect(result.warning).toContain('Area mismatch warning');
  });

  it('respects custom tolerance thresholds', () => {
    const calculatedArea = calculateGeoJSONAreaHectares(samplePolygon); // ~123.64 ha
    const declaredArea = calculatedArea * 1.08; // 8% difference

    // With 10% default tolerance -> Not divergent
    const defaultTol = validateProjectAreaDivergence(samplePolygon, declaredArea, 0.10);
    expect(defaultTol.isDivergent).toBe(false);

    // With 5% strict tolerance -> Divergent!
    const strictTol = validateProjectAreaDivergence(samplePolygon, declaredArea, 0.05);
    expect(strictTol.isDivergent).toBe(true);
    expect(strictTol.tolerance).toBe(0.05);
    expect(strictTol.warning).toContain('±5%');
  });
});

describe('areaValidation - validatePolygon', () => {
  it('rejects null or non-polygon geometries', () => {
    expect(validatePolygon(null).valid).toBe(false);
    expect(validatePolygon({ type: 'Point', coordinates: [0, 0] } as any).valid).toBe(false);
    expect(validatePolygon({ type: 'LineString', coordinates: [[0, 0], [1, 1]] } as any).valid).toBe(false);
  });

  it('rejects polygons with fewer than 4 points or missing coordinates', () => {
    expect(validatePolygon({ type: 'Polygon', coordinates: [] } as any).valid).toBe(false);
    expect(
      validatePolygon({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 0]]],
      }).valid
    ).toBe(false);
  });

  it('rejects unclosed polygons', () => {
    const openPolygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    };
    const result = validatePolygon(openPolygon);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('closed');
  });

  it('rejects self-intersecting polygons', () => {
    // Figure-8 (bowtie) self-intersecting polygon
    const bowtie: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 2],
          [0, 2],
          [2, 0],
          [0, 0],
        ],
      ],
    };
    const result = validatePolygon(bowtie);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('self-intersect');
  });

  it('accepts valid closed non-intersecting polygons', () => {
    const validPolygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0.05, 0],
          [0.05, 0.05],
          [0, 0.05],
          [0, 0],
        ],
      ],
    };
    const result = validatePolygon(validPolygon);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.areaHectares).toBeGreaterThan(0);
  });
});

describe('areaValidation - extractPolygonFromGeoJSON', () => {
  const polygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
  };

  it('extracts from raw Polygon geometry', () => {
    expect(extractPolygonFromGeoJSON(polygon)).toEqual(polygon);
  });

  it('extracts from GeoJSON Feature', () => {
    const feature = {
      type: 'Feature',
      properties: { name: 'My Parcel' },
      geometry: polygon,
    };
    expect(extractPolygonFromGeoJSON(feature)).toEqual(polygon);
  });

  it('extracts from GeoJSON FeatureCollection', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', properties: {}, geometry: polygon },
      ],
    };
    expect(extractPolygonFromGeoJSON(collection)).toEqual(polygon);
  });

  it('returns null for non-polygon or empty input', () => {
    expect(extractPolygonFromGeoJSON(null)).toBeNull();
    expect(extractPolygonFromGeoJSON({ type: 'Point', coordinates: [0, 0] })).toBeNull();
    expect(extractPolygonFromGeoJSON({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});
