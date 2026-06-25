// TypeScript interfaces for the Geospatial domain

export interface Geometry {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}

export interface ProjectGeometry {
  id: string;
  projectId: string;
  geometry: Geometry;
  createdAt: string;
  updatedAt: string;
}

export interface Geofence {
  id: string;
  projectId: string;
  name: string;
  geometry: Geometry;
  type: 'active' | 'historical' | 'breached';
  createdAt: string;
  updatedAt: string;
}

export interface MapTile {
  id: string;
  projectId: string;
  type: 'raster' | 'ndvi' | 'satellite';
  url: string;
  bounds: [number, number, number, number];
  createdAt: string;
}

export interface GeospatialLoadingState {
  isFetchingGeometry: boolean;
  isFetchingGeofences: boolean;
  isFetchingTiles: boolean;
  isUpdating: boolean;
}

export interface GeospatialErrorState {
  fetchGeometry: string | null;
  fetchGeofences: string | null;
  fetchTiles: string | null;
  update: string | null;
}

export interface GeospatialSlice {
  // State
  projectGeometries: ProjectGeometry[];
  geofences: Geofence[];
  mapTiles: MapTile[];
  selectedGeometry: ProjectGeometry | null;
  selectedGeofence: Geofence | null;
  geospatialLoading: GeospatialLoadingState;
  geospatialErrors: GeospatialErrorState;

  // Actions
  fetchProjectGeometry: (projectId: string) => Promise<void>;
  fetchAllProjectGeometries: () => Promise<void>;
  updateProjectGeometry: (projectId: string, geometry: Geometry) => Promise<ProjectGeometry | null>;
  fetchGeofences: (projectId: string) => Promise<void>;
  createGeofence: (projectId: string, data: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Geofence | null>;
  updateGeofence: (id: string, data: Partial<Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<Geofence | null>;
  deleteGeofence: (id: string) => Promise<boolean>;
  fetchMapTiles: (projectId: string, type?: string) => Promise<void>;
  setSelectedGeometry: (geometry: ProjectGeometry | null) => void;
  setSelectedGeofence: (geofence: Geofence | null) => void;
  clearGeospatialErrors: () => void;
  resetGeospatialState: () => void;
}
