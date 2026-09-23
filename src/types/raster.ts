/**
 * Spatial Reference and Raster Processing Types
 * Strictly typed interfaces for GeoTIFF, COG, and XYZ Tile Pipeline
 */

export interface LatLngBoundsLiteral {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export type LatLngTuple = [number, number]; // [lat, lng] for Leaflet
export type BoundingBoxTuple = [LatLngTuple, LatLngTuple]; // [[south, west], [north, east]]

export interface RasterSpatialMetadata {
  rasterId: string;
  filename: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  bands: number;
  epsg: number;
  projectionName: string;
  nativeBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  geographicBounds: BoundingBoxTuple; // [[minLat, minLng], [maxLat, maxLng]] in WGS84
  center: LatLngTuple; // [lat, lng]
  gsdMeters: number; // Ground Sample Distance in meters/pixel
  hasSpatialTags: boolean;
  bitDepth: number;
  tileUrlTemplate: string; // e.g. "/api/tiles/{raster_id}/{z}/{x}/{y}.png"
  minZoom: number;
  maxZoom: number;
  colorModel: "RGB" | "RGBA" | "Grayscale" | "Multispectral";
}

export interface RasterUploadResponse {
  success: boolean;
  message: string;
  metadata: RasterSpatialMetadata;
}

export interface ActiveRasterLayerConfig {
  id: string;
  name: string;
  url?: string;
  arrayBuffer?: ArrayBuffer;
  tileUrlTemplate?: string;
  bounds: BoundingBoxTuple;
  center: LatLngTuple;
  opacity: number;
  visible: boolean;
  epsg: number;
  gsdMeters: number;
  resolution: [number, number];
  colorSymbology: "NATURAL_RGB" | "INFRARED" | "FALSE_COLOR" | "ELEVATION_RAMP";
}

export interface EpsgDefinition {
  code: number;
  name: string;
  proj4String: string;
  areaOfUse: string;
}
