"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { geospatialApi } from "@/lib/geospatial/api";
import { getCarbonScribeSource } from "@/lib/geospatial/mapbox";
import { useStore } from "@/lib/store/store";
import type { ProjectGeometry, SatelliteImage } from "@/lib/store/geospatial/geospatial.types";
import { showErrorToast } from "@/lib/utils/toast";

// ============================================================================
// Types
// ============================================================================

interface CarbonMapProps {
  /** Project ID to display on the map */
  projectId: string;
  /** Whether the map is editable (allows boundary updates) */
  editable?: boolean;
  /** Height of the map container */
  height?: string | number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show satellite overlay toggle */
  showSatelliteToggle?: boolean;
  /** Whether to show carbon overlay */
  showCarbonOverlay?: boolean;
  /** Initial zoom level */
  initialZoom?: number;
  /** Initial center coordinates [lng, lat] */
  initialCenter?: [number, number];
  /** Callback when map is ready */
  onMapReady?: (map: mapboxgl.Map) => void;
  /** Callback when a project is clicked */
  onProjectClick?: (projectId: string, coordinates: [number, number]) => void;
  /** Callback when a boundary is saved */
  onBoundarySaved?: (geometry: GeoJSON.GeoJSON) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CENTER: [number, number] = [23.0, -2.0]; // Central Africa/Congo Basin
const DEFAULT_ZOOM = 4;
const MAX_ZOOM = 18;
const MIN_ZOOM = 2;

// Mapbox style URLs
const MAP_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
} as const;

type MapStyle = keyof typeof MAP_STYLES;

// ============================================================================
// Polygon Validation Utilities
// ============================================================================

/**
 * Calculate the area of a polygon in square meters using the shoelace formula
 */
const calculatePolygonArea = (coordinates: number[][]): number => {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordinates[i][0] * coordinates[j][1];
    area -= coordinates[j][0] * coordinates[i][1];
  }
  
  return Math.abs(area / 2);
};

/**
 * Check if a polygon self-intersects using a simple segment intersection check
 */
const hasSelfIntersection = (coordinates: number[][]): boolean => {
  const n = coordinates.length;
  if (n < 4) return false;
  
  // Helper to check if two line segments intersect
 const segmentsIntersect = (p1: number[], p2: number[], p3: number[], p4: number[]): boolean => {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);
    
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    
    return false;
  };
  
  const direction = (p1: number[], p2: number[], p3: number[]): number => {
    return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
  };
  
  // Check each pair of non-adjacent segments
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent segments and the first/last segment pair
      if (i === 0 && j === n - 1) continue;
      
      if (segmentsIntersect(
        coordinates[i],
        coordinates[(i + 1) % n],
        coordinates[j],
        coordinates[(j + 1) % n]
      )) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Validate a polygon geometry
 * @returns { valid: boolean, error?: string }
 */
const validatePolygon = (geometry: GeoJSON.GeoJSON): { valid: boolean; error?: string } => {
  if (geometry.type !== "Polygon") {
    return { valid: false, error: "Only polygon geometries are allowed" };
  }
  
  const polygon = geometry as GeoJSON.Polygon;
  const coordinates = polygon.coordinates[0];
  
  if (coordinates.length < 4) {
    return { valid: false, error: "Polygon must have at least 4 points (3 + closing point)" };
  }
  
  // Check if first and last points match (closed polygon)
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { valid: false, error: "Polygon must be closed (first and last points must match)" };
  }
  
  // Check for self-intersection
  if (hasSelfIntersection(coordinates)) {
    return { valid: false, error: "Polygon cannot self-intersect" };
  }
  
  // Calculate area (in approximate square degrees, convert to hectares for validation)
  const areaSqDegrees = calculatePolygonArea(coordinates);
  const areaHectares = areaSqDegrees * 12300; // Rough conversion for validation
  
  if (areaHectares < 0.01) {
    return { valid: false, error: "Polygon area is too small (minimum 0.01 hectares)" };
  }
  
  if (areaHectares > 100000) {
    return { valid: false, error: "Polygon area is too large (maximum 100,000 hectares)" };
  }
  
  return { valid: true };
};

// ============================================================================
// Component
// ============================================================================

export const CarbonMap: React.FC<CarbonMapProps> = ({
  projectId,
  editable = false,
  height = "h-96",
  className = "",
  showSatelliteToggle = true,
  showCarbonOverlay = true,
  initialZoom = DEFAULT_ZOOM,
  initialCenter = DEFAULT_CENTER,
  onMapReady,
  onProjectClick,
  onBoundarySaved,
}) => {
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const popups = useRef<mapboxgl.Popup[]>([]);
  const layers = useRef<string[]>([]);
  const drawControl = useRef<MapboxDraw | null>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [showSatellite, setShowSatellite] = useState(false);
  const [showCarbon, setShowCarbon] = useState(true);
  const [geometry, setGeometry] = useState<ProjectGeometry | null>(null);
  const [geometryLoading, setGeometryLoading] = useState(true);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [draftGeometry, setDraftGeometry] = useState<GeoJSON.GeoJSON | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Store - using the main store with selector
  const {
    projectGeometries,
    geofences,
    satelliteImages,
    ndviData,
    fetchSatelliteTimeSeries,
  } = useStore((state) => ({
    projectGeometries: state.projectGeometries || [],
    geofences: state.geofences || [],
    satelliteImages: state.satelliteImages || [],
    ndviData: state.ndviData || [],
    fetchSatelliteTimeSeries: state.fetchSatelliteTimeSeries,
  }));

  // ============================================================================
  // Mapbox Access Token
  // ============================================================================

  useEffect(() => {
    // Set Mapbox access token from environment variable
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) {
      setError("Mapbox access token not configured. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
      setLoading(false);
      return;
    }
    mapboxgl.accessToken = token;
  }, []);

  // ============================================================================
  // Load Geometry Data
  // ============================================================================

  useEffect(() => {
    const loadGeometry = async () => {
      if (!projectId) return;

      setGeometryLoading(true);
      setGeometryError(null);

      try {
        // Try to get from store first
        let geo = projectGeometries.find((g: ProjectGeometry) => g.projectId === projectId);

        // If not in store, fetch from API
        if (!geo) {
          geo = await geospatialApi.getProjectGeometry(projectId);
        }

        setGeometry(geo as ProjectGeometry);
      } catch (err: any) {
        setGeometryError(err.message || "Failed to load project geometry");
        showErrorToast("Failed to load project geometry");
      } finally {
        setGeometryLoading(false);
      }
    };

    loadGeometry();
  }, [projectId, projectGeometries]);

  // ============================================================================
  // Fetch Satellite Data
  // ============================================================================

  useEffect(() => {
    if (projectId && showSatellite && fetchSatelliteTimeSeries) {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      const start = startDate.toISOString().split("T")[0];

      fetchSatelliteTimeSeries(projectId, start, endDate);
    }
  }, [projectId, showSatellite, fetchSatelliteTimeSeries]);

  // ============================================================================
  // Draw Event Handlers
  // ============================================================================

  const handleDrawCreate = useCallback((e: any) => {
    if (!e.features || e.features.length === 0) return;
    
    const feature = e.features[0];
    if (feature.geometry.type !== "Polygon") {
      setValidationError("Only polygon shapes are allowed");
      if (drawControl.current) {
        drawControl.current.delete(feature.id);
      }
      return;
    }

    // Validate the polygon
    const validation = validatePolygon(feature.geometry);
    if (!validation.valid) {
      setValidationError(validation.error || "Invalid polygon");
      if (drawControl.current) {
        drawControl.current.delete(feature.id);
      }
      return;
    }

    setDraftGeometry(feature.geometry);
    setIsDrawing(true);
    setValidationError(null);
  }, []);

  const handleDrawUpdate = useCallback((e: any) => {
    if (!e.features || e.features.length === 0) return;
    
    const feature = e.features[0];
    
    // Validate the updated polygon
    const validation = validatePolygon(feature.geometry);
    if (!validation.valid) {
      setValidationError(validation.error || "Invalid polygon");
    } else {
      setDraftGeometry(feature.geometry);
      setValidationError(null);
    }
  }, []);

  const handleDrawDelete = useCallback(() => {
    setDraftGeometry(null);
    setIsDrawing(false);
    setValidationError(null);
  }, []);

  const handleSaveBoundary = useCallback(async () => {
    if (!draftGeometry || !projectId) return;

    setIsSaving(true);
    setValidationError(null);

    try {
      // Validate before saving
      const validation = validatePolygon(draftGeometry);
      if (!validation.valid) {
        setValidationError(validation.error || "Invalid polygon");
        setIsSaving(false);
        return;
      }

      // Upload geometry to API
      await geospatialApi.uploadGeometry(projectId, draftGeometry);
      
      // Update local state
      setGeometry({
        projectId,
        geometry: draftGeometry,
      } as ProjectGeometry);

      // Clear draft
      if (drawControl.current) {
        drawControl.current.deleteAll();
      }
      setDraftGeometry(null);
      setIsDrawing(false);

      // Call callback
      if (onBoundarySaved) {
        onBoundarySaved(draftGeometry);
      }

      // Refresh geometry from API
      const updatedGeometry = await geospatialApi.getProjectGeometry(projectId);
      setGeometry(updatedGeometry as ProjectGeometry);
    } catch (err: any) {
      setValidationError(err.message || "Failed to save boundary");
      showErrorToast("Failed to save boundary");
    } finally {
      setIsSaving(false);
    }
  }, [draftGeometry, projectId, onBoundarySaved]);

  const handleCancelDrawing = useCallback(() => {
    if (drawControl.current) {
      drawControl.current.deleteAll();
    }
    setDraftGeometry(null);
    setIsDrawing(false);
    setValidationError(null);
  }, []);

  const handleClearDrawing = useCallback(() => {
    if (drawControl.current) {
      drawControl.current.deleteAll();
    }
    setDraftGeometry(null);
    setIsDrawing(false);
    setValidationError(null);
  }, []);

  // ============================================================================
  // Initialize Map
  // ============================================================================

  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxgl.accessToken) return;

    const initializeMap = () => {
      try {
        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current!,
          style: MAP_STYLES[mapStyle],
          center: initialCenter,
          zoom: initialZoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          attributionControl: true,
        });

        map.current = mapInstance;

        // Add controls
        mapInstance.addControl(new mapboxgl.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true,
        }), "top-right");

        mapInstance.addControl(new mapboxgl.FullscreenControl(), "top-right");
        mapInstance.addControl(new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }), "top-right");

        // Handle map load
        mapInstance.on("load", () => {
          setMapLoaded(true);
          setLoading(false);

          // Add custom source for CarbonScribe tiles
          mapInstance.addSource("carbon-scribe", getCarbonScribeSource());

          // Add a layer for the CarbonScribe tiles
          mapInstance.addLayer({
            id: "carbon-scribe-layer",
            type: "raster",
            source: "carbon-scribe",
            layout: {
              visibility: "visible",
            },
            paint: {
              "raster-opacity": 0.8,
              "raster-saturation": 0.2,
              "raster-contrast": 0.1,
            },
          });

          // Add MapboxDraw control if editable
          if (editable) {
            const draw = new MapboxDraw({
              displayControlsDefault: false,
              controls: {
                polygon: true,
                trash: true,
              },
              defaultMode: "simple_select",
              styles: [
                {
                  id: "gl-draw-polygon-fill-inactive",
                  type: "fill",
                  filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"]],
                  paint: {
                    "fill-color": "#3B82F6",
                    "fill-opacity": 0.3,
                  },
                },
                {
                  id: "gl-draw-polygon-fill-active",
                  type: "fill",
                  filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
                  paint: {
                    "fill-color": "#3B82F6",
                    "fill-opacity": 0.5,
                  },
                },
                {
                  id: "gl-draw-polygon-stroke-inactive",
                  type: "line",
                  filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"]],
                  layout: {
                    "line-cap": "round",
                    "line-join": "round",
                  },
                  paint: {
                    "line-color": "#2563EB",
                    "line-width": 3,
                  },
                },
                {
                  id: "gl-draw-polygon-stroke-active",
                  type: "line",
                  filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
                  layout: {
                    "line-cap": "round",
                    "line-join": "round",
                  },
                  paint: {
                    "line-color": "#2563EB",
                    "line-width": 3,
                  },
                },
                {
                  id: "gl-draw-polygon-midpoint",
                  type: "circle",
                  filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["==", "meta", "midpoint"]],
                  paint: {
                    "circle-radius": 5,
                    "circle-color": "#3B82F6",
                  },
                },
                {
                  id: "gl-draw-polygon-vertex-active",
                  type: "circle",
                  filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["==", "active", "true"]],
                  paint: {
                    "circle-radius": 5,
                    "circle-color": "#3B82F6",
                  },
                },
                {
                  id: "gl-draw-polygon-vertex-inactive",
                  type: "circle",
                  filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["==", "active", "false"]],
                  paint: {
                    "circle-radius": 5,
                    "circle-color": "#3B82F6",
                  },
                },
              ],
            });

            mapInstance.addControl(draw, "top-left");
            drawControl.current = draw;

            // Handle draw events
            mapInstance.on("draw.create", handleDrawCreate);
            mapInstance.on("draw.update", handleDrawUpdate);
            mapInstance.on("draw.delete", handleDrawDelete);
          }

          // Call onMapReady callback
          if (onMapReady) {
            onMapReady(mapInstance);
          }

          // Apply initial layers
          updateMapLayers(mapInstance);
        });

        // Handle errors
        mapInstance.on("error", (e) => {
          console.error("Mapbox error:", e);
          setError("Failed to load map. Please try again.");
        });

        // Handle click on map features
        mapInstance.on("click", (e) => {
          const features = mapInstance.queryRenderedFeatures(e.point);
          const projectFeature = features.find(
            (f) => f.properties?.projectId || f.properties?.id
          );

          if (projectFeature) {
            const pid = projectFeature.properties?.projectId || projectFeature.properties?.id;
            if (pid && onProjectClick) {
              onProjectClick(pid, [e.lngLat.lng, e.lngLat.lat]);
            }
          }
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          mapInstance.resize();
        });

        if (mapContainer.current) {
          resizeObserver.observe(mapContainer.current);
        }

        return () => {
          resizeObserver.disconnect();
        };
      } catch (err: any) {
        setError(err.message || "Failed to initialize map");
        setLoading(false);
        showErrorToast("Map initialization failed");
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapStyle, initialCenter, initialZoom, onMapReady]);

  // ============================================================================
  // Update Map Layers
  // ============================================================================

  const updateMapLayers = useCallback((mapInstance: mapboxgl.Map) => {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    // Clear existing layers
    layers.current.forEach((layerId) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
    });
    layers.current = [];

    // Add geometry layer if available
    if (geometry?.geometry) {
      addGeometryLayer(mapInstance, geometry);
    }

    // Add carbon overlay if enabled
    if (showCarbon && geometry?.carbonData) {
      addCarbonOverlay(mapInstance, geometry);
    }

    // Add satellite overlay if enabled
    if (showSatellite && satelliteImages.length > 0) {
      addSatelliteOverlay(mapInstance, satelliteImages as SatelliteImage[]);
    }

    // Add geofences
    const projectGeofences = geofences.filter((g: any) => g.projectId === projectId);
    if (projectGeofences.length > 0) {
      addGeofences(mapInstance, projectGeofences);
    }

    // Add NDVI data if available and satellite is shown
    if (showSatellite && ndviData.length > 0) {
      addNDVILayer(mapInstance, ndviData);
    }
  }, [geometry, showCarbon, showSatellite, satelliteImages, ndviData, projectId, geofences]);

  // ============================================================================
  // Layer Builders
  // ============================================================================

  const addGeometryLayer = (mapInstance: mapboxgl.Map, geo: ProjectGeometry) => {
    const sourceId = `geometry-${geo.projectId}`;

    // Remove existing source if present
    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }

    // Add GeoJSON source
    mapInstance.addSource(sourceId, {
      type: "geojson",
      data: geo.geometry as GeoJSON.GeoJSON,
    });

    // Add fill layer
    const fillLayerId = `geometry-fill-${geo.projectId}`;
    mapInstance.addLayer({
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#10B981",
        "fill-opacity": 0.2,
        "fill-outline-color": "#059669",
      },
    });
    layers.current.push(fillLayerId);

    // Add outline layer
    const outlineLayerId = `geometry-outline-${geo.projectId}`;
    mapInstance.addLayer({
      id: outlineLayerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#059669",
        "line-width": 3,
        "line-dasharray": [4, 4],
      },
    });
    layers.current.push(outlineLayerId);

    // Add center marker if center coordinates exist
    const center = (geo as ProjectGeometry & { center?: { lng: number; lat: number } }).center;
    if (center && center.lng && center.lat) {
      const marker = new mapboxgl.Marker({
        color: "#10B981",
        scale: 1.2,
        draggable: editable,
      })
        .setLngLat([center.lng, center.lat])
        .addTo(mapInstance);

      markers.current.push(marker);

      // Add popup
      const areaText = (geo as ProjectGeometry & { areaHectares?: number }).areaHectares ? `${(geo as ProjectGeometry & { areaHectares?: number }).areaHectares?.toFixed(2)} ha` : "N/A";
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-2">
            <h4 class="font-semibold text-sm">Project Area</h4>
            <p class="text-xs text-gray-600">ID: ${geo.projectId}</p>
            <p class="text-xs text-gray-600">Area: ${areaText}</p>
          </div>
        `);

      marker.setPopup(popup);
      popups.current.push(popup);
    }
  };

  const addCarbonOverlay = (mapInstance: mapboxgl.Map, geo: ProjectGeometry) => {
    // This would be a heatmap or choropleth based on carbon data
    // For now, we'll add a simple heatmap layer
    
    const carbonData = (geo as ProjectGeometry & { carbonData?: { density: number; total: number; unit: string } }).carbonData;
    if (!carbonData || !mapInstance.getSource("carbon-scribe")) return;

    const heatmapLayerId = `carbon-heatmap-${geo.projectId}`;
    
    // Check if layer already exists
    if (mapInstance.getLayer(heatmapLayerId)) {
      mapInstance.removeLayer(heatmapLayerId);
    }

    mapInstance.addLayer({
      id: heatmapLayerId,
      type: "raster",
      source: "carbon-scribe",
      paint: {
        "raster-opacity": 0.4,
        "raster-color": [
          "interpolate",
          ["linear"],
          ["get", "carbon_density"],
          0, "rgba(255,255,255,0)",
          0.3, "rgba(255,255,0,0.5)",
          0.6, "rgba(255,165,0,0.7)",
          0.8, "rgba(255,0,0,0.8)",
        ],
      },
    });
    layers.current.push(heatmapLayerId);
  };

  const addSatelliteOverlay = (mapInstance: mapboxgl.Map, images: SatelliteImage[]) => {
    if (images.length === 0) return;

    const sourceId = "satellite-overlay";

    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }

    // Use the most recent image or fallback to tile URL
    const latestImage = images[images.length - 1];
    const tileUrl = (latestImage as SatelliteImage & { url?: string }).url || latestImage?.tileUrl || geospatialApi.getTileUrl("{z}", "{x}", "{y}");

    mapInstance.addSource(sourceId, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
    });

    const layerId = "satellite-overlay-layer";
    if (mapInstance.getLayer(layerId)) {
      mapInstance.removeLayer(layerId);
    }

    mapInstance.addLayer({
      id: layerId,
      type: "raster",
      source: sourceId,
      paint: {
        "raster-opacity": 0.7,
      },
    });
    layers.current.push(layerId);
  };

  const addGeofences = (mapInstance: mapboxgl.Map, geofencesList: any[]) => {
    geofencesList.forEach((geofence) => {
      if (!geofence.geometry) return;

      const sourceId = `geofence-${geofence.id}`;

      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }

      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: geofence.geometry,
      });

      const layerId = `geofence-layer-${geofence.id}`;
      mapInstance.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": geofence.alertRules?.on_enter ? "#EF4444" : "#F59E0B",
          "fill-opacity": 0.15,
          "fill-outline-color": geofence.alertRules?.on_enter ? "#DC2626" : "#D97706",
        },
      });
      layers.current.push(layerId);

      // Add border
      const borderId = `geofence-border-${geofence.id}`;
      mapInstance.addLayer({
        id: borderId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": geofence.alertRules?.on_enter ? "#DC2626" : "#D97706",
          "line-width": 2,
          "line-dasharray": [3, 3],
        },
      });
      layers.current.push(borderId);
    });
  };

  const addNDVILayer = (mapInstance: mapboxgl.Map, ndviDataList: any[]) => {
    if (ndviDataList.length === 0) return;

    const sourceId = "ndvi-overlay";

    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }

    // Create GeoJSON features from NDVI data
    const features = ndviDataList.map((point) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [point.lng || 0, point.lat || 0],
      },
      properties: {
        ndvi: point.value || 0,
      },
    }));

    mapInstance.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features,
      },
    });

    const layerId = "ndvi-layer";
    if (mapInstance.getLayer(layerId)) {
      mapInstance.removeLayer(layerId);
    }

    mapInstance.addLayer({
      id: layerId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": 8,
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
        "circle-opacity": 0.8,
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 1,
      },
    });
    layers.current.push(layerId);
  };

  // ============================================================================
  // Update Layers on Data Change
  // ============================================================================

  useEffect(() => {
    if (map.current && mapLoaded) {
      updateMapLayers(map.current);
    }
  }, [mapLoaded, updateMapLayers]);

  // ============================================================================
  // Handle Map Style Change
  // ============================================================================

  const handleStyleChange = (style: MapStyle) => {
    setMapStyle(style);
    if (map.current) {
      map.current.setStyle(MAP_STYLES[style]);
    }
  };

  // ============================================================================
  // Handle Satellite Toggle
  // ============================================================================

  const handleSatelliteToggle = () => {
    setShowSatellite(!showSatellite);
    if (map.current && mapLoaded) {
      // Toggle satellite overlay
      const layerId = "satellite-overlay-layer";
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, "visibility", showSatellite ? "none" : "visible");
      }
    }
  };

  // ============================================================================
  // Handle Carbon Overlay Toggle
  // ============================================================================

  const handleCarbonToggle = () => {
    setShowCarbon(!showCarbon);
    if (map.current && mapLoaded && geometry) {
      updateMapLayers(map.current);
    }
  };

  // ============================================================================
  // Handle Fit to Bounds
  // ============================================================================

  const fitToProject = useCallback(() => {
    if (!map.current || !geometry?.geometry) return;

    try {
      const bounds = new mapboxgl.LngLatBounds();
      
      // Extract coordinates from geometry
      const coords = (geometry.geometry as any).coordinates;
      if (coords) {
        // Simplified bounds calculation
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        const flattenCoords = (arr: any[]) => {
          arr.forEach((item) => {
            if (Array.isArray(item) && typeof item[0] === 'number' && typeof item[1] === 'number') {
              minLng = Math.min(minLng, item[0]);
              maxLng = Math.max(maxLng, item[0]);
              minLat = Math.min(minLat, item[1]);
              maxLat = Math.max(maxLat, item[1]);
            } else if (Array.isArray(item)) {
              flattenCoords(item);
            }
          });
        };
        
        flattenCoords(coords);
        
        if (isFinite(minLng) && isFinite(maxLng)) {
          bounds.extend([minLng, minLat]);
          bounds.extend([maxLng, maxLat]);
          
          map.current.fitBounds(bounds, {
            padding: 50,
            duration: 1000,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fit to project bounds:", err);
    }
  }, [geometry]);

  // ============================================================================
  // Render
  // ============================================================================

  const heightClass = typeof height === "number" ? `h-[${height}px]` : height;

  return (
    <div className={`relative ${className}`}>
      {/* Loading State */}
      {loading && (
        <div className={`${heightClass} w-full bg-gray-100 rounded-lg flex items-center justify-center`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className={`${heightClass} w-full bg-red-50 rounded-lg flex items-center justify-center`}>
          <div className="text-center p-4">
            <svg className="h-8 w-8 text-red-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-600 text-sm font-medium">Map Error</p>
            <p className="text-red-500 text-xs mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainer}
        className={`${heightClass} w-full rounded-lg overflow-hidden ${loading || error ? "hidden" : ""}`}
        style={{ position: "relative" }}
      />

      {/* Map Controls - Top Left */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        {/* Project Info */}
        {geometry && mapLoaded && (
          <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md text-sm">
            <p className="font-semibold text-gray-800">Project Area</p>
            <p className="text-xs text-gray-500">ID: {projectId}</p>
            {geometry.areaHectares && (
              <p className="text-xs text-gray-500">Area: {geometry.areaHectares.toFixed(2)} ha</p>
            )}
            <button
              onClick={fitToProject}
              className="mt-1 text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Fit to Project
            </button>
          </div>
        )}
      </div>

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        {/* Style Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 flex flex-col space-y-1">
          {Object.keys(MAP_STYLES).map((style) => (
            <button
              key={style}
              onClick={() => handleStyleChange(style as MapStyle)}
              className={`px-2 py-1 text-xs rounded transition ${
                mapStyle === style
                  ? "bg-green-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>

        {/* Layer Toggles */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2 flex flex-col space-y-1">
          {showSatelliteToggle && (
            <button
              onClick={handleSatelliteToggle}
              className={`px-3 py-1 text-xs rounded transition ${
                showSatellite
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              {showSatellite ? "Hide Satellite" : "Show Satellite"}
            </button>
          )}
          {showCarbonOverlay && (
            <button
              onClick={handleCarbonToggle}
              className={`px-3 py-1 text-xs rounded transition ${
                showCarbon
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              {showCarbon ? "Hide Carbon" : "Show Carbon"}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Info Bar */}
      {mapLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md text-xs text-gray-500">
          <span>📍 {geometryLoading ? "Loading geometry..." : geometry ? "Project boundary loaded" : "No geometry data"}</span>
          <span className="mx-2">•</span>
          <span>🛰️ {satelliteImages.length > 0 ? `${satelliteImages.length} images available` : "No satellite data"}</span>
          <span className="mx-2">•</span>
          <span>📊 {ndviData.length > 0 ? "NDVI data available" : "No NDVI data"}</span>
        </div>
      )}

      {/* Geometry Loading/Error Overlay */}
      {geometryLoading && mapLoaded && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
            <p className="text-xs text-gray-500">Loading geometry...</p>
          </div>
        </div>
      )}

      {geometryError && mapLoaded && !geometryLoading && (
        <div className="absolute bottom-16 left-4 right-4 z-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">
            ⚠️ {geometryError}
          </div>
        </div>
      )}

      {/* Drawing Controls */}
      {editable && mapLoaded && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col space-y-2">
          {/* Validation Error */}
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 max-w-xs">
              ⚠️ {validationError}
            </div>
          )}

          {/* Drawing Action Buttons */}
          {isDrawing && (
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2 flex flex-col space-y-1">
              <button
                onClick={handleSaveBoundary}
                disabled={isSaving || !!validationError}
                className={`px-3 py-2 text-xs rounded transition text-white ${
                  isSaving || validationError
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isSaving ? "Saving..." : "💾 Save Boundary"}
              </button>
              <button
                onClick={handleCancelDrawing}
                className="px-3 py-2 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
              >
                ❌ Cancel
              </button>
              <button
                onClick={handleClearDrawing}
                className="px-3 py-2 text-xs rounded bg-red-100 text-red-600 hover:bg-red-200 transition"
              >
                🗑️ Clear
              </button>
            </div>
          )}

          {/* Drawing Instructions */}
          {!isDrawing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-600 max-w-xs">
              <p className="font-medium">📐 Draw Mode Active</p>
              <p className="mt-1">Use the polygon tool in the top-left to draw your project boundary.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CarbonMap;