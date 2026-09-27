import { LandType, ParcelStatus } from "../types";

export function formatArea(sqMeters: number): { sqm: string; hectares: string; acres: string } {
  const sqm = sqMeters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hectares = (sqMeters / 10000).toFixed(4);
  const acres = (sqMeters * 0.000247105).toFixed(3);
  return { sqm, hectares, acres };
}

export function formatShortHash(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
}

export function getLandTypeColor(landType: LandType): {
  stroke: string;
  fill: string;
  badge: string;
  label: string;
} {
  switch (landType) {
    case "RESIDENTIAL":
      return {
        stroke: "#3B82F6", // Blue
        fill: "#60A5FA",
        badge: "bg-blue-100 text-blue-800 border-blue-200",
        label: "Residential",
      };
    case "COMMERCIAL":
      return {
        stroke: "#F59E0B", // Amber
        fill: "#FCD34D",
        badge: "bg-amber-100 text-amber-800 border-amber-200",
        label: "Commercial",
      };
    case "AGRICULTURAL":
      return {
        stroke: "#10B981", // Emerald
        fill: "#6EE7B7",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
        label: "Agricultural",
      };
    case "INDUSTRIAL":
      return {
        stroke: "#6366F1", // Indigo
        fill: "#A5B4FC",
        badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
        label: "Industrial",
      };
    case "PUBLIC_INFRASTRUCTURE":
      return {
        stroke: "#8B5CF6", // Purple
        fill: "#C4B5FD",
        badge: "bg-purple-100 text-purple-800 border-purple-200",
        label: "Public Infrastructure",
      };
    case "UNCLAIMED":
    default:
      return {
        stroke: "#9CA3AF", // Slate
        fill: "#D1D5DB",
        badge: "bg-gray-100 text-gray-800 border-gray-200",
        label: "Unclaimed / Vacant",
      };
  }
}

export function getStatusBadge(status: ParcelStatus): {
  text: string;
  className: string;
} {
  switch (status) {
    case "AUTOMATICALLY_ACCEPTED":
      return {
        text: "Automatically Accepted",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold",
      };
    case "ACCEPTED_AFTER_REVIEW":
      return {
        text: "Accepted After Review",
        className: "bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold",
      };
    case "REQUIRES_FIELD_INSPECTION":
      return {
        text: "Requires Field Inspection",
        className: "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold",
      };
    case "REJECTED_DISPUTED":
      return {
        text: "Rejected / Boundary Dispute",
        className: "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold",
      };
    case "TITLE_ISSUED":
      return {
        text: "Digital Title Certified (VDST)",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold",
      };
    case "TOPOLOGY_VERIFIED":
      return {
        text: "Topology Validated",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold",
      };
    case "SURVEYOR_ADJUSTED":
      return {
        text: "Surveyor Adjusted",
        className: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold",
      };
    case "ENCROACHMENT_DISPUTE":
      return {
        text: "Encroachment Alert",
        className: "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold",
      };
    case "DRAFT_SEGMENTATION":
    default:
      return {
        text: "AI Draft Segmentation",
        className: "bg-slate-500/20 text-slate-300 border-slate-500/40 font-semibold",
      };
  }
}

export function getUncertaintyColor(score: number): {
  hex: string;
  label: string;
  badgeClass: string;
} {
  if (score > 0.55) {
    return {
      hex: "#EF4444", // High uncertainty - Red
      label: "High Uncertainty (Priority Field Inspection)",
      badgeClass: "bg-red-100 text-red-800 border-red-200",
    };
  } else if (score > 0.3) {
    return {
      hex: "#F59E0B", // Medium uncertainty - Amber
      label: "Moderate Uncertainty",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    };
  } else {
    return {
      hex: "#10B981", // Low uncertainty - Green
      label: "Low Uncertainty (Surveyor Confirmed)",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  }
}

/**
 * Calculates geodesic distance between two points on earth in meters using Haversine formula
 */
export function calculateGeodesicDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes metric projected area using local planar approximation around reference latitude
 */
export function calculateShoelaceArea(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  const latRef = coords[0][1];
  const metersPerDegLat = 111132.92;
  const metersPerDegLon = 111412.84 * Math.cos((latRef * Math.PI) / 180);

  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = (coords[i][0] - coords[0][0]) * metersPerDegLon;
    const yi = (coords[i][1] - coords[0][1]) * metersPerDegLat;
    const xj = (coords[j][0] - coords[0][0]) * metersPerDegLon;
    const yj = (coords[j][1] - coords[0][1]) * metersPerDegLat;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

