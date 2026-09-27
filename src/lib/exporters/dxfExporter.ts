/**
 * GeoTrace-AI AutoCAD DXF Exporter Module
 * Generates AutoCAD R12 / 2000 compliant DXF files with structured engineering layers:
 * - BOUNDARIES_VALID (Color: Green 3)
 * - BOUNDARIES_OVERLAP (Color: Yellow 2)
 * - BOUNDARIES_INTERSECTION (Color: Red 1)
 * - VERTEX_PEGS (Color: Cyan 4)
 * - TEXT_LABELS (Color: White 7)
 */

import Drawing from "dxf-writer";
import proj4 from "proj4";
import { ParcelFeature, DXFExportOptions } from "../../types/exportTypes";

const WGS84 = "EPSG:4326";
const UTM44N = "+proj=utm +zone=44 +ellps=WGS84 +datum=WGS84 +units=m +no_defs";

/**
 * Normalizes coordinate pairs to [lat, lng]
 */
function normalizeToLatLng(coord: [number, number]): [number, number] {
  if (coord[0] > 50 && coord[1] < 40) {
    return [coord[1], coord[0]];
  }
  return [coord[0], coord[1]];
}

/**
 * Converts [lat, lng] to UTM Zone 44N Easting & Northing in meters
 */
function toUTM(lat: number, lng: number): [number, number] {
  try {
    const [easting, northing] = proj4(WGS84, UTM44N, [lng, lat]);
    return [Number(easting.toFixed(4)), Number(northing.toFixed(4))];
  } catch {
    // Geodesic fallback
    const latRad = (lat * Math.PI) / 180;
    const easting = 500000 + (lng - 81) * 111319 * Math.cos(latRad);
    const northing = lat * 110574;
    return [Number(easting.toFixed(4)), Number(northing.toFixed(4))];
  }
}

/**
 * Detects whether a 2D polygon self-intersects
 */
function hasSelfIntersection(ring: [number, number][]): boolean {
  const n = ring.length;
  if (n < 4) return false;

  function ccw(p1: [number, number], p2: [number, number], p3: [number, number]): number {
    return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
  }

  function edgesIntersect(
    a1: [number, number],
    a2: [number, number],
    b1: [number, number],
    b2: [number, number]
  ): boolean {
    const ccw1 = ccw(a1, a2, b1);
    const ccw2 = ccw(a1, a2, b2);
    const ccw3 = ccw(b1, b2, a1);
    const ccw4 = ccw(b1, b2, a2);
    return ((ccw1 > 0 && ccw2 < 0) || (ccw1 < 0 && ccw2 > 0)) &&
           ((ccw3 > 0 && ccw4 < 0) || (ccw3 < 0 && ccw4 > 0));
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue; // Adjacent first and last edges
      if (edgesIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Exports cadastral parcel polygons into a CAD-standard DXF string
 */
export function exportToDXF(
  parcels: ParcelFeature[],
  options: DXFExportOptions = {}
): string {
  const drawing = new Drawing();
  drawing.setUnits("Meters");

  // Configure AutoCAD Color Index (ACI) Layers
  // Green = 3, Yellow = 2, Red = 1, Cyan = 4, White = 7
  drawing.addLayer("BOUNDARIES_VALID", Drawing.ACI.GREEN, "CONTINUOUS");
  drawing.addLayer("BOUNDARIES_OVERLAP", Drawing.ACI.YELLOW, "CONTINUOUS");
  drawing.addLayer("BOUNDARIES_INTERSECTION", Drawing.ACI.RED, "CONTINUOUS");
  drawing.addLayer("VERTEX_PEGS", Drawing.ACI.CYAN, "CONTINUOUS");
  drawing.addLayer("TEXT_LABELS", Drawing.ACI.WHITE, "CONTINUOUS");

  for (const parcel of parcels) {
    const rawCoords = parcel.coordinates || [];
    if (rawCoords.length < 3) continue;

    const latLngs = rawCoords.map(normalizeToLatLng);

    // Convert boundary coordinates to metric UTM
    const utmPoints: [number, number][] = latLngs.map(([lat, lng]) => toUTM(lat, lng));

    // Ensure polyline is closed for boundary drawing
    const first = utmPoints[0];
    const last = utmPoints[utmPoints.length - 1];
    const isClosed =
      Math.abs(first[0] - last[0]) < 0.001 && Math.abs(first[1] - last[1]) < 0.001;

    const closedRing: [number, number][] = isClosed
      ? utmPoints
      : [...utmPoints, first];

    // Determine target layer based on topological validation
    const selfIntersects =
      parcel.hasSelfIntersection ||
      parcel.status === "REJECTED_DISPUTED" ||
      hasSelfIntersection(closedRing);

    const hasOverlapOrDispute =
      parcel.hasOverlap ||
      parcel.encroachmentDetected ||
      parcel.status === "ENCROACHMENT_DISPUTE" ||
      parcel.status === "REQUIRES_FIELD_INSPECTION";

    let targetLayer = "BOUNDARIES_VALID";
    if (selfIntersects) {
      targetLayer = "BOUNDARIES_INTERSECTION";
    } else if (hasOverlapOrDispute) {
      targetLayer = "BOUNDARIES_OVERLAP";
    }

    // Draw boundary polyline on designated layer
    drawing.setActiveLayer(targetLayer);
    drawing.drawPolyline(closedRing, true);

    // Draw vertex pegs on VERTEX_PEGS layer
    if (options.includeVertexPegs !== false) {
      drawing.setActiveLayer("VERTEX_PEGS");
      for (const [x, y] of utmPoints) {
        drawing.drawPoint(x, y);
      }
    }

    // Draw text labels (UPRN & Area) at centroid
    if (options.includeTextLabels !== false) {
      drawing.setActiveLayer("TEXT_LABELS");

      let centerUtm: [number, number];
      if (parcel.centroid) {
        centerUtm = toUTM(parcel.centroid.latitude, parcel.centroid.longitude);
      } else {
        const sumX = utmPoints.reduce((acc, p) => acc + p[0], 0);
        const sumY = utmPoints.reduce((acc, p) => acc + p[1], 0);
        centerUtm = [sumX / utmPoints.length, sumY / utmPoints.length];
      }

      const uprn = parcel.uprn || `UPRN-${parcel.surveyNumber || "PARCEL"}`;
      const areaVal = parcel.calculatedAreaSqMeters || parcel.historicalAreaSqM || 0;
      const areaText = `${areaVal.toFixed(1)} m²`;

      // Text height scaled for engineering readability (approx 1.5m text in CAD real-world metric)
      const textHeight = 1.6;
      drawing.drawText(centerUtm[0], centerUtm[1] + 1.2, textHeight, 0, uprn, "center", "middle");
      drawing.drawText(centerUtm[0], centerUtm[1] - 1.2, textHeight * 0.85, 0, areaText, "center", "middle");
    }
  }

  return drawing.toDxfString();
}

/**
 * Client-side helper to trigger download of AutoCAD DXF file
 */
export function downloadDXF(
  parcels: ParcelFeature[],
  filename?: string,
  options?: DXFExportOptions
): void {
  const dxfContent = exportToDXF(parcels, options);
  const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const defaultFilename =
    filename ||
    `Cadastral_Survey_${parcels[0]?.surveyNumber?.replace("/", "-") || "Layer"}.dxf`;

  const link = document.createElement("a");
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
