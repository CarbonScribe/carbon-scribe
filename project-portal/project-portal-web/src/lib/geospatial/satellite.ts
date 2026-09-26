import axios from "axios";
import { getReportsApiBase } from "../api";
import type {
  SatelliteImage,
  SatelliteTimeSeries,
  NDVIData,
  ExportOptions,
  SatelliteFilters,
} from "./satellite.types";

const BASE_URL = getReportsApiBase();

// Create an axios instance for geospatial requests
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000, // Increased timeout for satellite data
});

export interface GeofenceRequest {
  project_id: string;
  name: string;
  geometry: any; // GeoJSON
}

export const geospatialApi = {
  // Geometry Upload/Retrieval
  uploadGeometry: async (projectId: string, geometry: any) => {
    const response = await api.post(
      `/geospatial/projects/${projectId}/geometry`,
      {
        geometry,
      }
    );
    return response.data;
  },

  getProjectGeometry: async (projectId: string) => {
    const response = await api.get(
      `/geospatial/projects/${projectId}/geometry`
    );
    return response.data;
  },

  // Spatial Analysis
  analyzeIntersection: async (geometry: any) => {
    const response = await api.post(`/geospatial/analysis/intersect`, {
      geometry,
    });
    return response.data;
  },

  // Geofencing
  createGeofence: async (data: GeofenceRequest) => {
    const response = await api.post(`/geospatial/geofences`, data);
    return response.data;
  },

  // Maps & Tiles
  // Supports number for logic and string for Mapbox templates (e.g., "{z}")
  getTileUrl: (
    z: number | string,
    x: number | string,
    y: number | string,
    style = "satellite"
  ) => `${BASE_URL}/geospatial/maps/tile/${z}/${x}/${y}?style=${style}`,

  // ===================== NEW SATELLITE METHODS =====================

  /**
   * Fetch historical satellite imagery for a project
   */
  fetchHistoricalImagery: async (
    projectId: string,
    startDate: string,
    endDate: string,
    filters?: SatelliteFilters
  ): Promise<SatelliteTimeSeries> => {
    const response = await api.get(
      `/geospatial/satellite/${projectId}/historical`,
      {
        params: {
          startDate,
          endDate,
          minCloudCoverage: filters?.minCloudCoverage,
          maxCloudCoverage: filters?.maxCloudCoverage,
          sources: filters?.sources?.join(","),
          minResolution: filters?.minResolution,
        },
      }
    );
    return response.data;
  },

  /**
   * Fetch satellite image by ID
   */
  fetchSatelliteImage: async (imageId: string): Promise<SatelliteImage> => {
    const response = await api.get(`/geospatial/satellite/images/${imageId}`);
    return response.data;
  },

  /**
   * Fetch NDVI data for a specific date range
   */
  fetchNDVIData: async (
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<NDVIData[]> => {
    const response = await api.get(
      `/geospatial/satellite/${projectId}/ndvi`,
      {
        params: { startDate, endDate },
      }
    );
    return response.data;
  },

  /**
   * Fetch NDVI for a specific date
   */
  fetchNDVIForDate: async (
    projectId: string,
    date: string
  ): Promise<NDVIData> => {
    const response = await api.get(
      `/geospatial/satellite/${projectId}/ndvi/${date}`
    );
    return response.data;
  },

  /**
   * Generate time-lapse video/GIF
   */
  exportTimeLapse: async (
    projectId: string,
    startDate: string,
    endDate: string,
    options: ExportOptions
  ): Promise<Blob> => {
    const response = await api.post(
      `/geospatial/satellite/${projectId}/export`,
      {
        startDate,
        endDate,
        format: options.format,
        fps: options.fps || 2,
        quality: options.quality || 80,
        duration: options.duration,
        includeNDVI: options.includeNDVI || false,
      },
      {
        responseType: "blob",
      }
    );
    return response.data;
  },

  /**
   * Get available date range for a project's satellite data
   */
  getAvailableDateRange: async (
    projectId: string
  ): Promise<{ startDate: string; endDate: string }> => {
    const response = await api.get(
      `/geospatial/satellite/${projectId}/date-range`
    );
    return response.data;
  },

  /**
   * Check if satellite data is available for a project
   */
  checkDataAvailability: async (
    projectId: string
  ): Promise<{
    available: boolean;
    imageCount: number;
    earliestDate: string | null;
    latestDate: string | null;
  }> => {
    const response = await api.get(
      `/geospatial/satellite/${projectId}/availability`
    );
    return response.data;
  },
};