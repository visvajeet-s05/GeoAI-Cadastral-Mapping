import { Parcel } from "../types";
import { metricDistanceMeters } from "./topologySnapping";

export type TopologyViolationType =
  | "SELF_INTERSECTION"
  | "PARCEL_OVERLAP"
  | "BOUNDARY_ENCROACHMENT"
  | "SPIKE_OR_COLLINEAR";

export interface VertexViolation {
  vertexIndex: number;
  violationType: TopologyViolationType;
  severity: "ERROR" | "WARNING";
  title: string;
  description: string;
  coord: [number, number]; // [lng, lat]
  conflictParcelId?: string;
  conflictParcelUprn?: string;
  conflictParcelOwner?: string;
  intersectingEdge?: {
    start: [number, number];
    end: [number, number];
    edgeIndex: number;
  };
}

export interface ViolatingSegment {
  start: [number, number]; // [lng, lat]
  end: [number, number];   // [lng, lat]
  startIndex: number;
  endIndex: number;
  reason: string;
}

export interface IntersectionPointAlert {
  point: [number, number]; // [lng, lat]
  label: string;
  edgeA: string;
  edgeB: string;
}

export interface TopologyValidationResult {
  isValid: boolean;
  violatingVertexIndices: Set<number>;
  violations: VertexViolation[];
  violationsByVertex: Map<number, VertexViolation[]>;
  selfIntersectionsCount: number;
  overlapsCount: number;
  encroachmentsCount: number;
  violatingSegments: ViolatingSegment[];
  intersectionPoints: IntersectionPointAlert[];
  summaryMessage: string;
}

/**
 * 2D Cross Product of vectors OA and OB: (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x)
 */
function crossProduct2D(
  o: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Check if point q lies on segment pr
 */
function onSegment(
  p: [number, number],
  q: [number, number],
  r: [number, number],
  epsilon = 1e-9
): boolean {
  return (
    q[0] <= Math.max(p[0], r[0]) + epsilon &&
    q[0] >= Math.min(p[0], r[0]) - epsilon &&
    q[1] <= Math.max(p[1], r[1]) + epsilon &&
    q[1] >= Math.min(p[1], r[1]) - epsilon
  );
}

/**
 * Checks whether line segment p1-q1 and segment p2-q2 intersect.
 * Returns intersection details and strictly intersecting flag (excluding shared common endpoints).
 */
export function checkSegmentIntersection(
  p1: [number, number],
  q1: [number, number],
  p2: [number, number],
  q2: [number, number],
  tolMeters = 0.15
): {
  intersects: boolean;
  isSharedEndpoint: boolean;
  intersectionPoint?: [number, number];
} {
  const refLat = (p1[1] + p2[1]) / 2;

  // Check if endpoints are shared or coincident (within tolerance)
  const d_p1_p2 = metricDistanceMeters(p1, p2, refLat);
  const d_p1_q2 = metricDistanceMeters(p1, q2, refLat);
  const d_q1_p2 = metricDistanceMeters(q1, p2, refLat);
  const d_q1_q2 = metricDistanceMeters(q1, q2, refLat);

  if (
    d_p1_p2 < tolMeters ||
    d_p1_q2 < tolMeters ||
    d_q1_p2 < tolMeters ||
    d_q1_q2 < tolMeters
  ) {
    return { intersects: false, isSharedEndpoint: true };
  }

  const cp1 = crossProduct2D(p1, q1, p2);
  const cp2 = crossProduct2D(p1, q1, q2);
  const cp3 = crossProduct2D(p2, q2, p1);
  const cp4 = crossProduct2D(p2, q2, q1);

  // General strict crossing case
  if (
    ((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) &&
    ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))
  ) {
    // Calculate approximate intersection coordinate
    const denom = (q1[0] - p1[0]) * (q2[1] - p2[1]) - (q1[1] - p1[1]) * (q2[0] - p2[0]);
    if (Math.abs(denom) > 1e-12) {
      const t =
        ((p2[0] - p1[0]) * (q2[1] - p2[1]) - (p2[1] - p1[1]) * (q2[0] - p2[0])) / denom;
      const interLng = p1[0] + t * (q1[0] - p1[0]);
      const interLat = p1[1] + t * (q1[1] - p1[1]);
      return { intersects: true, isSharedEndpoint: false, intersectionPoint: [interLng, interLat] };
    }
    return { intersects: true, isSharedEndpoint: false };
  }

  // Collinear and overlapping cases
  const eps = 1e-9;
  if (Math.abs(cp1) < eps && onSegment(p1, p2, q1)) return { intersects: true, isSharedEndpoint: false };
  if (Math.abs(cp2) < eps && onSegment(p1, q2, q1)) return { intersects: true, isSharedEndpoint: false };
  if (Math.abs(cp3) < eps && onSegment(p2, p1, q2)) return { intersects: true, isSharedEndpoint: false };
  if (Math.abs(cp4) < eps && onSegment(p2, q1, q2)) return { intersects: true, isSharedEndpoint: false };

  return { intersects: false, isSharedEndpoint: false };
}

/**
 * Standard Ray-Casting algorithm to test if a point is strictly inside a polygon ring
 */
export function isPointInsidePolygon(
  point: [number, number],
  polygonCoords: [number, number][]
): boolean {
  if (!polygonCoords || polygonCoords.length < 3) return false;
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const xi = polygonCoords[i][0];
    const yi = polygonCoords[i][1];
    const xj = polygonCoords[j][0];
    const yj = polygonCoords[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Minimum metric distance from a point to a polygon's boundary perimeter
 */
export function distanceToPolygonPerimeter(
  point: [number, number],
  polygonCoords: [number, number][]
): number {
  if (!polygonCoords || polygonCoords.length < 2) return Infinity;
  let minDist = Infinity;
  const refLat = point[1];

  for (let i = 0; i < polygonCoords.length - 1; i++) {
    const a = polygonCoords[i];
    const b = polygonCoords[i + 1];

    // Project point on segment
    const d = metricDistanceToSegment(point, a, b, refLat);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Distance in meters from point P to line segment AB
 */
function metricDistanceToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  refLat: number
): number {
  const metersPerDegLat = 111132.92;
  const metersPerDegLon = 111412.84 * Math.cos((refLat * Math.PI) / 180);

  const bx = (b[0] - a[0]) * metersPerDegLon;
  const by = (b[1] - a[1]) * metersPerDegLat;
  const px = (p[0] - a[0]) * metersPerDegLon;
  const py = (p[1] - a[1]) * metersPerDegLat;

  const lenSq = bx * bx + by * by;
  if (lenSq === 0) return Math.sqrt(px * px + py * py);

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  const projX = t * bx;
  const projY = t * by;

  const dx = px - projX;
  const dy = py - projY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Bounding box check for fast rejection
 */
function getBBox(coords: [number, number][]): {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
} {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const c of coords) {
    if (c[0] < minLng) minLng = c[0];
    if (c[0] > maxLng) maxLng = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
  }
  return { minLng, maxLng, minLat, maxLat };
}

function doBBoxesIntersect(
  b1: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  b2: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  buffer = 0.0001
): boolean {
  return (
    b1.minLng - buffer <= b2.maxLng &&
    b1.maxLng + buffer >= b2.minLng &&
    b1.minLat - buffer <= b2.maxLat &&
    b1.maxLat + buffer >= b2.minLat
  );
}

/**
 * Validate topological constraints for the currently edited polygon coordinates.
 *
 * Constraints checked:
 * 1. Self-intersection: No edge in the polygon crosses any non-adjacent edge.
 * 2. Parcel overlap: No vertex/edge of this parcel penetrates into an adjacent legal parcel's interior.
 * 3. Encroachment (Building): If editing building footprint, all corners must stay inside parent parcel.
 * 4. Spike / Degenerate edges: No consecutive identical vertices.
 */
export function validateTopologyConstraints(
  coords: [number, number][],
  currentParcel: Parcel | null | undefined,
  allParcels: Parcel[],
  target: "PARCEL" | "BUILDING" = "PARCEL"
): TopologyValidationResult {
  const violatingVertexIndices = new Set<number>();
  const violations: VertexViolation[] = [];
  const violatingSegments: ViolatingSegment[] = [];
  const intersectionPoints: IntersectionPointAlert[] = [];

  if (!coords || coords.length < 3) {
    return {
      isValid: true,
      violatingVertexIndices,
      violations,
      violationsByVertex: new Map(),
      selfIntersectionsCount: 0,
      overlapsCount: 0,
      encroachmentsCount: 0,
      violatingSegments,
      intersectionPoints,
      summaryMessage: "Insufficient vertices for topological validation.",
    };
  }

  // Normalize polygon: determine unique vertices count N
  // If first === last, the unique vertices are 0 .. N-1 where N = coords.length - 1
  const isClosed =
    coords.length > 1 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];
  const numVertices = isClosed ? coords.length - 1 : coords.length;
  const ring = isClosed ? coords : [...coords, coords[0]];
  const numEdges = ring.length - 1;

  // -------------------------------------------------------------------------
  // CONSTRAINT 1: SELF-INTERSECTION DETECTION
  // -------------------------------------------------------------------------
  let selfIntersectionsCount = 0;

  for (let i = 0; i < numEdges; i++) {
    const p1 = ring[i];
    const q1 = ring[i + 1];

    for (let j = i + 1; j < numEdges; j++) {
      // Adjacent edges share a vertex, skip them
      if (j === i + 1) continue;
      // First and last edge share the closing vertex, skip
      if (i === 0 && j === numEdges - 1) continue;

      const p2 = ring[j];
      const q2 = ring[j + 1];

      const inter = checkSegmentIntersection(p1, q1, p2, q2, 0.1);
      if (inter.intersects) {
        selfIntersectionsCount++;

        // Map ring indices back to original vertex indices (modulo numVertices)
        const v1 = i % numVertices;
        const v2 = (i + 1) % numVertices;
        const v3 = j % numVertices;
        const v4 = (j + 1) % numVertices;

        violatingVertexIndices.add(v1);
        violatingVertexIndices.add(v2);
        violatingVertexIndices.add(v3);
        violatingVertexIndices.add(v4);

        const edgeNameA = `Edge #${v1 + 1}–#${v2 + 1}`;
        const edgeNameB = `Edge #${v3 + 1}–#${v4 + 1}`;

        violatingSegments.push({
          start: p1,
          end: q1,
          startIndex: v1,
          endIndex: v2,
          reason: `Self-intersection: ${edgeNameA} crosses ${edgeNameB}`,
        });
        violatingSegments.push({
          start: p2,
          end: q2,
          startIndex: v3,
          endIndex: v4,
          reason: `Self-intersection: ${edgeNameB} crosses ${edgeNameA}`,
        });

        if (inter.intersectionPoint) {
          intersectionPoints.push({
            point: inter.intersectionPoint,
            label: `Self-Intersection: ${edgeNameA} ✕ ${edgeNameB}`,
            edgeA: edgeNameA,
            edgeB: edgeNameB,
          });
        }

        // Add violation records for each involved vertex
        [v1, v2, v3, v4].forEach((vIdx) => {
          violations.push({
            vertexIndex: vIdx,
            violationType: "SELF_INTERSECTION",
            severity: "ERROR",
            title: "Topological Self-Intersection",
            description: `${edgeNameA} crosses ${edgeNameB}. Parcel boundary forms a self-intersecting bowtie.`,
            coord: coords[vIdx],
            intersectingEdge: {
              start: p2,
              end: q2,
              edgeIndex: j,
            },
          });
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // CONSTRAINT 2: ADJACENT PARCEL OVERLAP DETECTION (WHEN EDITING PARCEL)
  // -------------------------------------------------------------------------
  let overlapsCount = 0;

  if (target === "PARCEL" && currentParcel) {
    const myBBox = getBBox(coords);
    const otherParcels = allParcels.filter((p) => p.id !== currentParcel.id);

    for (const neighbor of otherParcels) {
      if (!neighbor.coordinates || neighbor.coordinates.length < 3) continue;
      const nBBox = getBBox(neighbor.coordinates);

      // Fast bounding box rejection
      if (!doBBoxesIntersect(myBBox, nBBox)) continue;

      // 2A. Check each vertex of currently edited parcel
      for (let i = 0; i < numVertices; i++) {
        const pt = coords[i];
        const isInside = isPointInsidePolygon(pt, neighbor.coordinates);

        if (isInside) {
          // Verify that this is not simply a snapped point on the shared boundary
          const distToBoundary = distanceToPolygonPerimeter(pt, neighbor.coordinates);
          // If distance is greater than 0.35m, it is strictly penetrating the neighbor's property!
          if (distToBoundary > 0.35) {
            overlapsCount++;
            violatingVertexIndices.add(i);

            violations.push({
              vertexIndex: i,
              violationType: "PARCEL_OVERLAP",
              severity: "ERROR",
              title: "Adjacent Parcel Overlap Violation",
              description: `Peg #${i + 1} penetrates ${distToBoundary.toFixed(2)}m inside neighbor parcel ${neighbor.uprn} (${neighbor.ownerName}). Overlapping parcel areas are legally forbidden.`,
              coord: pt,
              conflictParcelId: neighbor.id,
              conflictParcelUprn: neighbor.uprn,
              conflictParcelOwner: neighbor.ownerName,
            });
          }
        }
      }

      // 2B. Check if any edge of edited parcel cuts into neighbor parcel
      const nRing = neighbor.coordinates;
      for (let i = 0; i < numEdges; i++) {
        const p1 = ring[i];
        const q1 = ring[i + 1];
        const v1 = i % numVertices;
        const v2 = (i + 1) % numVertices;

        for (let j = 0; j < nRing.length - 1; j++) {
          const np1 = nRing[j];
          const nq1 = nRing[j + 1];

          const inter = checkSegmentIntersection(p1, q1, np1, nq1, 0.25);
          if (inter.intersects) {
            // Check midpoint of current edge or test if edge penetrates interior
            const midX = (p1[0] + q1[0]) / 2;
            const midY = (p1[1] + q1[1]) / 2;
            const isMidInside = isPointInsidePolygon([midX, midY], neighbor.coordinates);

            if (isMidInside) {
              overlapsCount++;
              violatingVertexIndices.add(v1);
              violatingVertexIndices.add(v2);

              violatingSegments.push({
                start: p1,
                end: q1,
                startIndex: v1,
                endIndex: v2,
                reason: `Boundary edge cuts into parcel ${neighbor.uprn}`,
              });

              violations.push({
                vertexIndex: v1,
                violationType: "PARCEL_OVERLAP",
                severity: "ERROR",
                title: "Boundary Edge Overlap",
                description: `Edge #${v1 + 1}–#${v2 + 1} intersects and cuts through parcel ${neighbor.uprn} (${neighbor.ownerName}).`,
                coord: p1,
                conflictParcelId: neighbor.id,
                conflictParcelUprn: neighbor.uprn,
                conflictParcelOwner: neighbor.ownerName,
              });
              violations.push({
                vertexIndex: v2,
                violationType: "PARCEL_OVERLAP",
                severity: "ERROR",
                title: "Boundary Edge Overlap",
                description: `Edge #${v1 + 1}–#${v2 + 1} intersects and cuts through parcel ${neighbor.uprn} (${neighbor.ownerName}).`,
                coord: q1,
                conflictParcelId: neighbor.id,
                conflictParcelUprn: neighbor.uprn,
                conflictParcelOwner: neighbor.ownerName,
              });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // CONSTRAINT 3: BUILDING FOOTPRINT ENCLOSURE (WHEN EDITING BUILDING)
  // -------------------------------------------------------------------------
  let encroachmentsCount = 0;

  if (target === "BUILDING" && currentParcel && currentParcel.coordinates) {
    const parentCoords = currentParcel.coordinates;

    for (let i = 0; i < numVertices; i++) {
      const pt = coords[i];
      const isInsideParent = isPointInsidePolygon(pt, parentCoords);

      if (!isInsideParent) {
        // Allow tiny tolerance for roof edges exactly on parcel boundary (0.20m)
        const distToEdge = distanceToPolygonPerimeter(pt, parentCoords);
        if (distToEdge > 0.20) {
          encroachmentsCount++;
          violatingVertexIndices.add(i);

          violations.push({
            vertexIndex: i,
            violationType: "BOUNDARY_ENCROACHMENT",
            severity: "ERROR",
            title: "Setback & Encroachment Violation",
            description: `Rooftop corner #${i + 1} extends ${distToEdge.toFixed(2)}m outside legal parcel ${currentParcel.uprn} boundary. Buildings cannot exceed plot perimeter.`,
            coord: pt,
            conflictParcelId: currentParcel.id,
            conflictParcelUprn: currentParcel.uprn,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // CONSTRAINT 4: DEGENERATE / SPIKE SEGMENTS
  // -------------------------------------------------------------------------
  for (let i = 0; i < numVertices; i++) {
    const cur = coords[i];
    const nxt = coords[(i + 1) % numVertices];
    const dist = metricDistanceMeters(cur, nxt, cur[1]);

    if (dist < 0.20 && numVertices > 3) {
      violatingVertexIndices.add(i);
      violations.push({
        vertexIndex: i,
        violationType: "SPIKE_OR_COLLINEAR",
        severity: "WARNING",
        title: "Degenerate Edge (Zero Length)",
        description: `Peg #${i + 1} is only ${(dist * 100).toFixed(0)}cm from Peg #${((i + 1) % numVertices) + 1}. Vertices should be distinct.`,
        coord: cur,
      });
    }
  }

  // Group violations by vertex index for quick lookup
  const violationsByVertex = new Map<number, VertexViolation[]>();
  for (const v of violations) {
    const existing = violationsByVertex.get(v.vertexIndex) || [];
    existing.push(v);
    violationsByVertex.set(v.vertexIndex, existing);
  }

  // Format concise summary message
  const totalViolations = violatingVertexIndices.size;
  const isValid = totalViolations === 0;

  let summaryMessage = "Topological integrity verified: 0 boundary violations.";
  if (!isValid) {
    const parts: string[] = [];
    if (selfIntersectionsCount > 0) {
      parts.push(`${selfIntersectionsCount} self-intersection${selfIntersectionsCount > 1 ? "s" : ""}`);
    }
    if (overlapsCount > 0) {
      parts.push(`${overlapsCount} adjacent parcel overlap${overlapsCount > 1 ? "s" : ""}`);
    }
    if (encroachmentsCount > 0) {
      parts.push(`${encroachmentsCount} setback boundary encroachment${encroachmentsCount > 1 ? "s" : ""}`);
    }
    summaryMessage = `Topological Violation Detected: ${parts.join(", ") || `${totalViolations} invalid vertices`}.`;
  }

  return {
    isValid,
    violatingVertexIndices,
    violations,
    violationsByVertex,
    selfIntersectionsCount,
    overlapsCount,
    encroachmentsCount,
    violatingSegments,
    intersectionPoints,
    summaryMessage,
  };
}
