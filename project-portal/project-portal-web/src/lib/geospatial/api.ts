import axios from "axios";
import { getReportsApiBase } from "../api";

const BASE_URL = getReportsApiBase();

// Create an axios instance for geospatial requests
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
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
      },
    );
    return response.data;
  },

  getProjectGeometry: async (projectId: string) => {
    const response = await api.get(
      `/geospatial/projects/${projectId}/geometry`,
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
    style = "satellite",
  ) => `${BASE_URL}/geospatial/maps/tile/${z}/${x}/${y}?style=${style}`,
};
