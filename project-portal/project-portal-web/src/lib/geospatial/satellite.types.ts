import type { Geometry as GeoJSONGeometry } from 'geojson';


export interface SatelliteImage {
  id: string;
  projectId: string;
  date: string; // ISO date string
  timestamp: number; // Unix timestamp for sorting
  tileUrl: string;
  thumbnailUrl?: string;
  cloudCoverage?: number;
  source: 'sentinel-2' | 'landsat-8' | 'planet';
  resolution?: number;
  ndvi?: number;
  geometry?: GeoJSON.Polygon;
}

export interface SatelliteTimeSeries {
  projectId: string;
  images: SatelliteImage[];
  startDate: string;
  endDate: string;
  totalImages: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface NDVIData {
  date: string;
  value: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface ExportOptions {
  format: 'video' | 'gif';
  fps?: number;
  quality?: number;
  duration?: number;
  includeNDVI?: boolean;
}

export interface TimeLapseConfig {
  projectId: string;
  startDate: string;
  endDate: string;
  speed: number;
  currentFrame: number;
  isPlaying: boolean;
  showNDVI: boolean;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface SatelliteFilters {
  minCloudCoverage?: number;
  maxCloudCoverage?: number;
  sources?: Array<'sentinel-2' | 'landsat-8' | 'planet'>;
  minResolution?: number;
}