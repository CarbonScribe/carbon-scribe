/**
 * Mapbox GL Configuration
 * 
 * Provides Mapbox GL configuration, sources, and utilities
 * for the Carbon Map component.
 * 
 * @module geospatial/mapbox
 */

import { geospatialApi } from "./api";

// ============================================================================
// Types
// ============================================================================

export interface MapboxConfig {
  /** Mapbox access token */
  accessToken: string;
  /** Default map style */
  defaultStyle: string;
  /** Default center coordinates [lng, lat] */
  defaultCenter: [number, number];
  /** Default zoom level */
  defaultZoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** Max bounds for the map */
  maxBounds?: [[number, number], [number, number]];
}

// ============================================================================
// Constants
// ============================================================================

/** Default map configuration focused on Central Africa/Congo Basin */
export const MAP_CONFIG: MapboxConfig = {
  accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "",
  defaultStyle: "mapbox://styles/mapbox/light-v11",
  defaultCenter: [23.0, -2.0], // Central Africa/Congo Basin focus
  defaultZoom: 4,
  minZoom: 2,
  maxZoom: 18,
  maxBounds: [
    [-20, -40],
    [60, 40],
  ],
};

/** Map style options */
export const MAP_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  streets: "mapbox://styles/mapbox/streets-v11",
} as const;

export type MapStyle = keyof typeof MAP_STYLES;

// ============================================================================
// Sources
// ============================================================================

/**
 * Create a raster source for CarbonScribe tiles
 */
export const getCarbonScribeSource = () => ({
  type: "raster" as const,
  tiles: [geospatialApi.getTileUrl("{z}", "{x}", "{y}")],
  tileSize: 256,
  minzoom: 0,
  maxzoom: 22,
});

/**
 * Create a GeoJSON source for project boundaries
 */
export const getGeoJSONSource = (data: GeoJSON.GeoJSON) => ({
  type: "geojson" as const,
  data,
});

/**
 * Create a vector source for satellite imagery
 */
export const getSatelliteSource = (url: string) => ({
  type: "raster" as const,
  tiles: [url],
  tileSize: 256,
});

// ============================================================================
// Layer Builders
// ============================================================================

/**
 * Build a fill layer for project boundaries
 */
export const buildFillLayer = (
  id: string,
  sourceId: string,
  options?: {
    color?: string;
    opacity?: number;
    outlineColor?: string;
  }
) => ({
  id,
  type: "fill" as const,
  source: sourceId,
  paint: {
    "fill-color": options?.color || "#10B981",
    "fill-opacity": options?.opacity || 0.2,
    "fill-outline-color": options?.outlineColor || "#059669",
  },
});

/**
 * Build a line layer for boundary outlines
 */
export const buildLineLayer = (
  id: string,
  sourceId: string,
  options?: {
    color?: string;
    width?: number;
    dasharray?: number[];
  }
) => ({
  id,
  type: "line" as const,
  source: sourceId,
  paint: {
    "line-color": options?.color || "#059669",
    "line-width": options?.width || 3,
    "line-dasharray": options?.dasharray || [4, 4],
  },
});

/**
 * Build a heatmap layer for carbon data
 */
export const buildHeatmapLayer = (
  id: string,
  sourceId: string,
  options?: {
    opacity?: number;
    radius?: number;
    intensity?: number;
  }
) => ({
  id,
  type: "heatmap" as const,
  source: sourceId,
  paint: {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "density"], 0, 0, 1, 1],
    "heatmap-intensity": options?.intensity || 0.2,
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(33,102,172,0)",
      0.2, "rgb(103,169,207)",
      0.4, "rgb(209,229,240)",
      0.6, "rgb(253,219,199)",
      0.8, "rgb(239,138,98)",
      1, "rgb(178,24,43)",
    ],
    "heatmap-radius": options?.radius || 30,
    "heatmap-opacity": options?.opacity || 0.6,
  },
});

/**
 * Build a circle layer for NDVI points
 */
export const buildCircleLayer = (
  id: string,
  sourceId: string,
  options?: {
    radius?: number;
    opacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
  }
) => ({
  id,
  type: "circle" as const,
  source: sourceId,
  paint: {
    "circle-radius": options?.radius || 8,
    "circle-color": [
      "interpolate",
      ["linear"],
      ["get", "ndvi"],
      -0.2, "#F87171",
      0, "#FBBF24",
      0.3, "#34D399",
      0.6, "#10B981",
      0.8, "#047857",
    ],
    "circle-opacity": options?.opacity || 0.8,
    "circle-stroke-color": options?.strokeColor || "#FFFFFF",
    "circle-stroke-width": options?.strokeWidth || 1,
  },
});

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get the Mapbox style URL for a given style name
 */
export const getMapStyle = (style: MapStyle): string => {
  return MAP_STYLES[style] || MAP_STYLES.light;
};

/**
 * Check if Mapbox access token is configured
 */
export const isMapboxConfigured = (): boolean => {
  return !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
};

/**
 * Get the Mapbox access token from environment
 */
export const getMapboxToken = (): string => {
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
};

export default {
  MAP_CONFIG,
  MAP_STYLES,
  getCarbonScribeSource,
  getGeoJSONSource,
  getSatelliteSource,
  buildFillLayer,
  buildLineLayer,
  buildHeatmapLayer,
  buildCircleLayer,
  getMapStyle,
  isMapboxConfigured,
  getMapboxToken,
};