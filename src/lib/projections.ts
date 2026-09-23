import proj4 from "proj4";
import { BoundingBoxTuple, LatLngTuple, EpsgDefinition } from "../types/raster";

// Predefined EPSG Coordinate Systems relevant to Indian Cadastral & Global Surveys
export const SUPPORTED_EPSG_SYSTEMS: EpsgDefinition[] = [
  {
    code: 32644,
    name: "WGS 84 / UTM Zone 44N",
    proj4String: "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs",
    areaOfUse: "Tamil Nadu, Andhra Pradesh, Telangana, Odisha (80°E to 86°E)",
  },
  {
    code: 32643,
    name: "WGS 84 / UTM Zone 43N",
    proj4String: "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs",
    areaOfUse: "Kerala, Karnataka, Maharashtra, Goa (72°E to 78°E)",
  },
  {
    code: 4326,
    name: "WGS 84 (Geographic Lat/Lng)",
    proj4String: "+proj=longlat +datum=WGS84 +no_defs",
    areaOfUse: "Global standard GPS coordinates (Degrees)",
  },
  {
    code: 3857,
    name: "WGS 84 / Pseudo-Mercator",
    proj4String: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs",
    areaOfUse: "Web Mercator standard for Google Maps / OpenStreetMap",
  },
  {
    code: 24378,
    name: "Kalianpur 1975 / India Zone IV",
    proj4String: "+proj=lcc +lat_1=12 +lat_2=16 +lat_0=14 +lon_0=80 +k_0=0.99878640777 +x_0=2000000 +y_0=1000000 +a=6377301.243 +b=6356100.228368102 +units=m +no_defs",
    areaOfUse: "Historical Survey of India Topo Sheets (Zone IV)",
  },
];

// Initialize proj4 definitions
SUPPORTED_EPSG_SYSTEMS.forEach((sys) => {
  try {
    proj4.defs(`EPSG:${sys.code}`, sys.proj4String);
  } catch (err) {
    console.warn(`Failed to register EPSG:${sys.code} in proj4:`, err);
  }
});

/**
 * Reprojects a 2D coordinate [x, y] from source EPSG to WGS84 [lng, lat]
 */
export function reprojectToWgs84(
  x: number,
  y: number,
  sourceEpsg: number
): [number, number] {
  if (sourceEpsg === 4326) {
    // Already WGS84 [lng, lat]
    return [x, y];
  }

  const sourceDef = `EPSG:${sourceEpsg}`;
  try {
    const [lng, lat] = proj4(sourceDef, "EPSG:4326", [x, y]);
    return [lng, lat];
  } catch (err) {
    console.warn(`Reprojection error from EPSG:${sourceEpsg} to EPSG:4326:`, err);
    // Fallback: If numbers look already like lat/lng
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
      return [x, y];
    }
    throw new Error(
      `Cannot reproject coordinates [${x}, ${y}] from unsupported EPSG:${sourceEpsg}`
    );
  }
}

/**
 * Transforms bounding box from native coordinates [minX, minY, maxX, maxY]
 * to Leaflet LatLng Bounding Box [[minLat, minLng], [maxLat, maxLng]]
 */
export function transformNativeBoundsToLeaflet(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  sourceEpsg: number
): BoundingBoxTuple {
  // Check if bounds are already geographic WGS84
  if (
    sourceEpsg === 4326 ||
    (Math.abs(minX) <= 180 &&
      Math.abs(maxX) <= 180 &&
      Math.abs(minY) <= 90 &&
      Math.abs(maxY) <= 90)
  ) {
    const south = Math.min(minY, maxY);
    const north = Math.max(minY, maxY);
    const west = Math.min(minX, maxX);
    const east = Math.max(minX, maxX);
    return [
      [south, west],
      [north, east],
    ];
  }

  // Corner points reprojection
  const sw = reprojectToWgs84(minX, minY, sourceEpsg);
  const se = reprojectToWgs84(maxX, minY, sourceEpsg);
  const nw = reprojectToWgs84(minX, maxY, sourceEpsg);
  const ne = reprojectToWgs84(maxX, maxY, sourceEpsg);

  const lats = [sw[1], se[1], nw[1], ne[1]];
  const lngs = [sw[0], se[0], nw[0], ne[0]];

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Calculates center LatLng point from BoundingBoxTuple
 */
export function getBoundingBoxCenter(bounds: BoundingBoxTuple): LatLngTuple {
  const minLat = bounds[0][0];
  const minLng = bounds[0][1];
  const maxLat = bounds[1][0];
  const maxLng = bounds[1][1];

  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}
