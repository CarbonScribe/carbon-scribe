import { geospatialApi } from "./api";

export const getCarbonScribeSource = () => ({
  type: "raster" as const,
  tiles: [geospatialApi.getTileUrl("{z}", "{x}", "{y}")],
  tileSize: 256,
});

export const MAP_CONFIG = {
  defaultCenter: [23.0, -2.0] as [number, number], // Central Africa/Congo Basin focus
  defaultZoom: 4,
};
