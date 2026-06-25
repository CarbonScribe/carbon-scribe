import apiClient from '@/lib/api/apiClient';
import type { ProjectGeometry, Geofence, MapTile, Geometry } from './geospatial.types';

export async function fetchProjectGeometryApi(projectId: string): Promise<ProjectGeometry> {
  const response = await apiClient.get<ProjectGeometry>(`/geospatial/projects/${projectId}/geometry`);
  return response.data;
}

export async function fetchAllProjectGeometriesApi(): Promise<ProjectGeometry[]> {
  const response = await apiClient.get<{ geometries: ProjectGeometry[] }>('/geospatial/geometries');
  return response.data.geometries || [];
}

export async function updateProjectGeometryApi(projectId: string, geometry: Geometry): Promise<ProjectGeometry> {
  const response = await apiClient.put<ProjectGeometry>(`/geospatial/projects/${projectId}/geometry`, { geometry });
  return response.data;
}

export async function fetchGeofencesApi(projectId: string): Promise<Geofence[]> {
  const response = await apiClient.get<{ geofences: Geofence[] }>(`/geospatial/projects/${projectId}/geofences`);
  return response.data.geofences || [];
}

export async function createGeofenceApi(projectId: string, data: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>): Promise<Geofence> {
  const response = await apiClient.post<Geofence>(`/geospatial/projects/${projectId}/geofences`, data);
  return response.data;
}

export async function updateGeofenceApi(id: string, data: Partial<Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Geofence> {
  const response = await apiClient.put<Geofence>(`/geospatial/geofences/${id}`, data);
  return response.data;
}

export async function deleteGeofenceApi(id: string): Promise<void> {
  await apiClient.delete(`/geospatial/geofences/${id}`);
}

export async function fetchMapTilesApi(projectId: string, type?: string): Promise<MapTile[]> {
  const params = type ? { type } : {};
  const response = await apiClient.get<{ tiles: MapTile[] }>(`/geospatial/projects/${projectId}/tiles`, { params });
  return response.data.tiles || [];
}
