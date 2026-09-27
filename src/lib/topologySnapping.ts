import { Parcel } from "../types";

export type SnapMode = "ALL" | "EDGES_AND_VERTICES" | "GRID_ONLY" | "OFF";

export interface SnapConfig {
  mode: SnapMode;
  snapToleranceMeters: number; // e.g. 2.0m
  gridResolutionMeters: number; // e.g. 1.0m, 0.5m, 2.0m
  enableEdgeSnapping: boolean;
  enableVertexSnapping: boolean;
  enableGridSnapping: boolean;
}

export interface SnapResult {
  snappedPoint: [number, number]; // [lng, lat]
  originalPoint: [number, number]; // [lng, lat]
  isSnapped: boolean;
  snapType?: "VERTEX" | "EDGE" | "GRID";
  distanceMeters: number;
  targetParcelId?: string;
  targetParcelUprn?: string;
  targetVertexIndex?: number;
  edgeStart?: [number, number]; // [lng, lat]
  edgeEnd?: [number, number]; // [lng, lat]
  description: string;
  topologicalBenefit: string;
}

/**
 * Metric conversion helper using local tangent plane approximation
 */
function getMetersPerDeg(refLat: number): { metersPerDegLat: number; metersPerDegLon: number } {
  const metersPerDegLat = 111132.92;
  const metersPerDegLon = 111412.84 * Math.cos((refLat * Math.PI) / 180);
  return { metersPerDegLat, metersPerDegLon };
}

/**
 * Metric Euclidean distance between two [lng, lat] coordinates
 */
export function metricDistanceMeters(
  p1: [number, number],
  p2: [number, number],
  refLat: number
): number {
  const { metersPerDegLat, metersPerDegLon } = getMetersPerDeg(refLat);
  const dx = (p2[0] - p1[0]) * metersPerDegLon;
  const dy = (p2[1] - p1[1]) * metersPerDegLat;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Projects a metric point onto a line segment AB.
 * Returns the projected point in [lng, lat], the distance in meters, and whether it lies within the segment.
 */
function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  refLat: number
): { projected: [number, number]; distanceMeters: number; t: number } {
  const { metersPerDegLat, metersPerDegLon } = getMetersPerDeg(refLat);

  // Convert to local metric cartesian coordinates relative to point a
  const bx = (b[0] - a[0]) * metersPerDegLon;
  const by = (b[1] - a[1]) * metersPerDegLat;
  const px = (p[0] - a[0]) * metersPerDegLon;
  const py = (p[1] - a[1]) * metersPerDegLat;

  const segLenSq = bx * bx + by * by;
  if (segLenSq === 0) {
    const dist = Math.sqrt(px * px + py * py);
    return { projected: a, distanceMeters: dist, t: 0 };
  }

  // Projection scalar t: dot(P, B) / |B|^2
  const rawT = (px * bx + py * by) / segLenSq;
  const t = Math.max(0, Math.min(1, rawT));

  const projX = t * bx;
  const projY = t * by;

  const dx = px - projX;
  const dy = py - projY;
  const distanceMeters = Math.sqrt(dx * dx + dy * dy);

  // Convert projected metric coordinates back to [lng, lat]
  const projectedLng = a[0] + projX / metersPerDegLon;
  const projectedLat = a[1] + projY / metersPerDegLat;

  return {
    projected: [projectedLng, projectedLat],
    distanceMeters,
    t,
  };
}

/**
 * Evaluates the best snap target for a vertex currently being repositioned.
 * Priority hierarchy:
 * 1. Adjacent parcel vertex (Node Snapping)
 * 2. Adjacent parcel boundary edge (Edge Segment Snapping)
 * 3. Survey coordinate grid (Metric Grid Snapping)
 */
export function computeTopologySnap(
  dragCoord: [number, number], // [lng, lat]
  currentParcelId: string | undefined,
  candidateParcels: Parcel[],
  config: SnapConfig
): SnapResult {
  const originalPoint = dragCoord;
  const refLat = dragCoord[1];
  const tolerance = config.snapToleranceMeters;

  if (config.mode === "OFF") {
    return {
      snappedPoint: originalPoint,
      originalPoint,
      isSnapped: false,
      distanceMeters: 0,
      description: "Snapping Disabled",
      topologicalBenefit: "Free Drag Mode",
    };
  }

  const allowVertices =
    config.enableVertexSnapping &&
    (config.mode === "ALL" || config.mode === "EDGES_AND_VERTICES");
  const allowEdges =
    config.enableEdgeSnapping &&
    (config.mode === "ALL" || config.mode === "EDGES_AND_VERTICES");
  const allowGrid =
    config.enableGridSnapping &&
    (config.mode === "ALL" || config.mode === "GRID_ONLY");

  let bestVertexMatch: {
    point: [number, number];
    distance: number;
    parcelId: string;
    parcelUprn: string;
    vertexIdx: number;
  } | null = null;

  let bestEdgeMatch: {
    projected: [number, number];
    distance: number;
    parcelId: string;
    parcelUprn: string;
    edgeStart: [number, number];
    edgeEnd: [number, number];
  } | null = null;

  // Filter neighboring parcels (exclude the parcel currently being edited)
  const otherParcels = candidateParcels.filter(
    (p) => !currentParcelId || p.id !== currentParcelId
  );

  // 1. Search for Adjacent Parcel Vertices & Edges
  for (const parcel of otherParcels) {
    const coords = parcel.coordinates;
    if (!coords || coords.length < 3) continue;

    // A. Check Vertices
    if (allowVertices) {
      for (let i = 0; i < coords.length; i++) {
        const v = coords[i];
        const dist = metricDistanceMeters(dragCoord, v, refLat);
        if (dist <= tolerance) {
          if (!bestVertexMatch || dist < bestVertexMatch.distance) {
            bestVertexMatch = {
              point: [v[0], v[1]],
              distance: dist,
              parcelId: parcel.id,
              parcelUprn: parcel.uprn,
              vertexIdx: i + 1,
            };
          }
        }
      }
    }

    // B. Check Boundary Edge Segments
    if (allowEdges) {
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        const { projected, distanceMeters } = projectPointOnSegment(
          dragCoord,
          a,
          b,
          refLat
        );

        if (distanceMeters <= tolerance) {
          if (!bestEdgeMatch || distanceMeters < bestEdgeMatch.distance) {
            bestEdgeMatch = {
              projected,
              distance: distanceMeters,
              parcelId: parcel.id,
              parcelUprn: parcel.uprn,
              edgeStart: a,
              edgeEnd: b,
            };
          }
        }
      }
    }
  }

  // Prefer vertex snapping if close enough, or edge snapping if closer
  if (bestVertexMatch && (!bestEdgeMatch || bestVertexMatch.distance <= bestEdgeMatch.distance * 1.1)) {
    return {
      snappedPoint: bestVertexMatch.point,
      originalPoint,
      isSnapped: true,
      snapType: "VERTEX",
      distanceMeters: bestVertexMatch.distance,
      targetParcelId: bestVertexMatch.parcelId,
      targetParcelUprn: bestVertexMatch.parcelUprn,
      targetVertexIndex: bestVertexMatch.vertexIdx,
      description: `Snapped to Vertex #${bestVertexMatch.vertexIdx} of ${bestVertexMatch.parcelUprn}`,
      topologicalBenefit: "Shared Coincident Peg (Zero Boundary Gap)",
    };
  }

  if (bestEdgeMatch) {
    return {
      snappedPoint: bestEdgeMatch.projected,
      originalPoint,
      isSnapped: true,
      snapType: "EDGE",
      distanceMeters: bestEdgeMatch.distance,
      targetParcelId: bestEdgeMatch.parcelId,
      targetParcelUprn: bestEdgeMatch.parcelUprn,
      edgeStart: bestEdgeMatch.edgeStart,
      edgeEnd: bestEdgeMatch.edgeEnd,
      description: `Snapped to Boundary Edge of ${bestEdgeMatch.parcelUprn}`,
      topologicalBenefit: "Collinear Edge Alignment (Zero Sliver / Overlap)",
    };
  }

  // 2. Fall back to Metric Survey Grid Snapping if enabled
  if (allowGrid) {
    const { metersPerDegLat, metersPerDegLon } = getMetersPerDeg(refLat);
    const gridRes = Math.max(0.1, config.gridResolutionMeters);

    // Anchor metric grid to integer meter coordinates
    const curX = dragCoord[0] * metersPerDegLon;
    const curY = dragCoord[1] * metersPerDegLat;

    const snapX = Math.round(curX / gridRes) * gridRes;
    const snapY = Math.round(curY / gridRes) * gridRes;

    const dx = curX - snapX;
    const dy = curY - snapY;
    const gridDist = Math.sqrt(dx * dx + dy * dy);

    // If within grid snap threshold (within 40% of grid cell or tolerance)
    const gridTolerance = Math.min(tolerance, gridRes * 0.48);
    if (gridDist <= gridTolerance) {
      const snappedLng = snapX / metersPerDegLon;
      const snappedLat = snapY / metersPerDegLat;

      return {
        snappedPoint: [snappedLng, snappedLat],
        originalPoint,
        isSnapped: true,
        snapType: "GRID",
        distanceMeters: gridDist,
        description: `Snapped to ${gridRes}m Cadastral Survey Grid`,
        topologicalBenefit: `Sub-meter Metric Precision (±${gridDist.toFixed(2)}m)`,
      };
    }
  }

  // No snap detected; return free drag point
  return {
    snappedPoint: originalPoint,
    originalPoint,
    isSnapped: false,
    distanceMeters: 0,
    description: "Free Coordinate Alignment",
    topologicalBenefit: "Manual Positioning",
  };
}
