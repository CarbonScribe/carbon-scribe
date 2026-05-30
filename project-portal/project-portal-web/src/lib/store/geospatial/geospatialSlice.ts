import { StateCreator } from 'zustand';
import type { GeospatialSlice, ProjectGeometry, Geofence, MapTile, Geometry } from './geospatial.types';
import {
  fetchProjectGeometryApi,
  fetchAllProjectGeometriesApi,
  updateProjectGeometryApi,
  fetchGeofencesApi,
  createGeofenceApi,
  updateGeofenceApi,
  deleteGeofenceApi,
  fetchMapTilesApi,
} from './geospatial.api';
import { getErrorMessage } from '@/lib/utils/errorMessage';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';

const initialState: Pick<
  GeospatialSlice,
  'projectGeometries' | 'geofences' | 'mapTiles' | 'selectedGeometry' | 'selectedGeofence' | 'geospatialLoading' | 'geospatialErrors'
> = {
  projectGeometries: [],
  geofences: [],
  mapTiles: [],
  selectedGeometry: null,
  selectedGeofence: null,
  geospatialLoading: {
    isFetchingGeometry: false,
    isFetchingGeofences: false,
    isFetchingTiles: false,
    isUpdating: false,
  },
  geospatialErrors: {
    fetchGeometry: null,
    fetchGeofences: null,
    fetchTiles: null,
    update: null,
  },
};

export const createGeospatialSlice: StateCreator<GeospatialSlice> = (set, get) => ({
  ...initialState,

  fetchProjectGeometry: async (projectId: string) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isFetchingGeometry: true },
      geospatialErrors: { ...state.geospatialErrors, fetchGeometry: null },
    }));

    try {
      const geometry = await fetchProjectGeometryApi(projectId);
      set((state) => ({
        projectGeometries: state.projectGeometries
          .filter((g) => g.projectId !== projectId)
          .concat([geometry]),
        geospatialLoading: { ...get().geospatialLoading, isFetchingGeometry: false },
      }));
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isFetchingGeometry: false },
        geospatialErrors: { ...state.geospatialErrors, fetchGeometry: getErrorMessage(error) },
      }));
    }
  },

  fetchAllProjectGeometries: async () => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isFetchingGeometry: true },
      geospatialErrors: { ...state.geospatialErrors, fetchGeometry: null },
    }));

    try {
      const geometries = await fetchAllProjectGeometriesApi();
      set({
        projectGeometries: geometries,
        geospatialLoading: { ...get().geospatialLoading, isFetchingGeometry: false },
      });
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isFetchingGeometry: false },
        geospatialErrors: { ...state.geospatialErrors, fetchGeometry: getErrorMessage(error) },
      }));
    }
  },

  updateProjectGeometry: async (projectId: string, geometry: Geometry) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isUpdating: true },
      geospatialErrors: { ...state.geospatialErrors, update: null },
    }));

    try {
      const updatedGeometry = await updateProjectGeometryApi(projectId, geometry);
      set((state) => ({
        projectGeometries: state.projectGeometries
          .map((g) => (g.projectId === projectId ? updatedGeometry : g)),
        selectedGeometry: state.selectedGeometry?.projectId === projectId ? updatedGeometry : state.selectedGeometry,
        geospatialLoading: { ...get().geospatialLoading, isUpdating: false },
      }));
      showSuccessToast('Geometry updated successfully');
      return updatedGeometry;
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isUpdating: false },
        geospatialErrors: { ...state.geospatialErrors, update: getErrorMessage(error) },
      }));
      showErrorToast('Failed to update geometry');
      return null;
    }
  },

  fetchGeofences: async (projectId: string) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isFetchingGeofences: true },
      geospatialErrors: { ...state.geospatialErrors, fetchGeofences: null },
    }));

    try {
      const geofences = await fetchGeofencesApi(projectId);
      set((state) => ({
        geofences: state.geofences
          .filter((g) => g.projectId !== projectId)
          .concat(geofences),
        geospatialLoading: { ...get().geospatialLoading, isFetchingGeofences: false },
      }));
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isFetchingGeofences: false },
        geospatialErrors: { ...state.geospatialErrors, fetchGeofences: getErrorMessage(error) },
      }));
    }
  },

  createGeofence: async (projectId: string, data: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isUpdating: true },
      geospatialErrors: { ...state.geospatialErrors, update: null },
    }));

    try {
      const newGeofence = await createGeofenceApi(projectId, data);
      set((state) => ({
        geofences: [...state.geofences, newGeofence],
        geospatialLoading: { ...get().geospatialLoading, isUpdating: false },
      }));
      showSuccessToast('Geofence created successfully');
      return newGeofence;
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isUpdating: false },
        geospatialErrors: { ...state.geospatialErrors, update: getErrorMessage(error) },
      }));
      showErrorToast('Failed to create geofence');
      return null;
    }
  },

  updateGeofence: async (id: string, data: Partial<Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>>) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isUpdating: true },
      geospatialErrors: { ...state.geospatialErrors, update: null },
    }));

    try {
      const updatedGeofence = await updateGeofenceApi(id, data);
      set((state) => ({
        geofences: state.geofences.map((g) => (g.id === id ? updatedGeofence : g)),
        selectedGeofence: state.selectedGeofence?.id === id ? updatedGeofence : state.selectedGeofence,
        geospatialLoading: { ...get().geospatialLoading, isUpdating: false },
      }));
      showSuccessToast('Geofence updated successfully');
      return updatedGeofence;
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isUpdating: false },
        geospatialErrors: { ...state.geospatialErrors, update: getErrorMessage(error) },
      }));
      showErrorToast('Failed to update geofence');
      return null;
    }
  },

  deleteGeofence: async (id: string) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isUpdating: true },
      geospatialErrors: { ...state.geospatialErrors, update: null },
    }));

    try {
      await deleteGeofenceApi(id);
      set((state) => ({
        geofences: state.geofences.filter((g) => g.id !== id),
        selectedGeofence: state.selectedGeofence?.id === id ? null : state.selectedGeofence,
        geospatialLoading: { ...get().geospatialLoading, isUpdating: false },
      }));
      showSuccessToast('Geofence deleted successfully');
      return true;
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isUpdating: false },
        geospatialErrors: { ...state.geospatialErrors, update: getErrorMessage(error) },
      }));
      showErrorToast('Failed to delete geofence');
      return false;
    }
  },

  fetchMapTiles: async (projectId: string, type?: string) => {
    set((state) => ({
      geospatialLoading: { ...state.geospatialLoading, isFetchingTiles: true },
      geospatialErrors: { ...state.geospatialErrors, fetchTiles: null },
    }));

    try {
      const tiles = await fetchMapTilesApi(projectId, type);
      set((state) => ({
        mapTiles: state.mapTiles
          .filter((t) => t.projectId !== projectId || (type && t.type !== type))
          .concat(tiles),
        geospatialLoading: { ...get().geospatialLoading, isFetchingTiles: false },
      }));
    } catch (error: unknown) {
      set((state) => ({
        geospatialLoading: { ...state.geospatialLoading, isFetchingTiles: false },
        geospatialErrors: { ...state.geospatialErrors, fetchTiles: getErrorMessage(error) },
      }));
    }
  },

  setSelectedGeometry: (geometry) => set({ selectedGeometry: geometry }),
  setSelectedGeofence: (geofence) => set({ selectedGeofence: geofence }),

  clearGeospatialErrors: () =>
    set({
      geospatialErrors: {
        fetchGeometry: null,
        fetchGeofences: null,
        fetchTiles: null,
        update: null,
      },
    }),

  resetGeospatialState: () => set({ ...initialState }),
});
