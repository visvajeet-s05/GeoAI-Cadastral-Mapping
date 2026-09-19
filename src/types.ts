export type LandType =
  | "RESIDENTIAL"
  | "COMMERCIAL"
  | "AGRICULTURAL"
  | "INDUSTRIAL"
  | "UNCLAIMED"
  | "PUBLIC_INFRASTRUCTURE";

export type ParcelStatus =
  | "DRAFT_SEGMENTATION"
  | "TOPOLOGY_VERIFIED"
  | "SURVEYOR_ADJUSTED"
  | "TITLE_ISSUED"
  | "ENCROACHMENT_DISPUTE"
  | "AUTOMATICALLY_ACCEPTED"
  | "ACCEPTED_AFTER_REVIEW"
  | "REQUIRES_FIELD_INSPECTION"
  | "REJECTED_DISPUTED";

export interface Parcel {
  id: string;
  uprn: string;
  geoTraceCardNumber: string;
  svamitvaCardNumber?: string;
  ownerName: string;
  ownerNationalId: string;
  landType: LandType;
  status: ParcelStatus;
  coordinates: [number, number][];
  calculatedAreaSqMeters: number;
  perimeterMeters: number;
  centroid: { latitude: number; longitude: number };
  vertexCount: number;
  epistemicUncertainty: number;
  aleatoricUncertainty: number;
  overallUncertainty: number;
  structureCount: number;
  complianceScore: number;
  encroachmentDetected: boolean;
  encroachmentRemarks?: string;
  surveyorNotes?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  currentHash: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuditBlock {
  parcelId: string;
  blockIndex: number;
  action: string;
  previousHash: string;
  currentHash: string;
  coordinatesPayloadSha: string;
  surveyorId: string;
  surveyorName: string;
  digitalSignature?: string;
  changeDescription: string;
  timestamp: number;
  verified?: boolean;
}

export interface TopologyOverlap {
  parcelAUprn: string;
  parcelBUprn: string;
  overlapAreaApproxSqM: number;
  severity: "LOW" | "MEDIUM" | "CRITICAL";
  description: string;
}

export interface TopologyReport {
  networkIntegrityScore: number;
  totalParcels: number;
  validParcelsCount: number;
  overlapsDetectedCount: number;
  overlaps: TopologyOverlap[];
  individualReports?: Array<{
    id: string;
    uprn: string;
    isValid: boolean;
    hasSelfIntersection: boolean;
    vertexCount: number;
  }>;
}

export interface VlmAuditResult {
  land_type: string;
  structure_count: number;
  compliance_score: number;
  encroachment_detected: boolean;
  encroachment_details: string;
  geo_title_eligible?: boolean;
  svamitva_title_eligible?: boolean;
  recommendations: string[];
  model?: string;
}

export interface ActiveLayers {
  vectorBoundaries: boolean;
  structuralFootprints: boolean;
  uncertaintyHeatmap: boolean;
  zoningColors: boolean;
  topologyIssues: boolean;
  satelliteBasemap: boolean;
  legalGovLayout?: boolean;
  discrepancyOverlay?: boolean;
  gcpControlPoints?: boolean;
  discrepancyHeatmap?: boolean;
}

export interface DriftHotspot {
  lat: number;
  lng: number;
  weight: number; // 0 to 1 normalized intensity
  deviationMeters: number;
  areaSqM: number;
  encroachmentType: string;
  parcelId: string;
  uprn: string;
  ownerName: string;
  sourceType: "SATELLITE_LEGAL_DRIFT" | "ROAD_ENCROACHMENT" | "BOUNDARY_SHIFT";
  driftVector?: {
    fromLegal: [number, number];
    toPhysical: [number, number];
  };
}

export interface GroundControlPoint {
  id: string;
  name: string;
  pixelX: number;
  pixelY: number;
  targetLat: number;
  targetLng: number;
  residualMeters?: number;
}
  surveyNumber: string;
  subDivision?: string;
  portalSource: "eservices.tn.gov.in" | "cmdachennai.gov.in" | "tcp.tn.gov.in";
  portalUrl: string;
  status: "APPROVED" | "REGULARIZED" | "UNDER_REVIEW";
  roadWidthMeters: number;
  mandatoryFrontSetbackM: number;
  osrAreaSqM: number;
  approvedPlotsCount: number;
  legalBoundaries: Array<{
    plotNumber: string;
    uprnMatch?: string;
    coordinates: [number, number][];
    legalAreaSqM: number;
    intendedUse: "RESIDENTIAL" | "COMMERCIAL" | "ROAD_RESERVE" | "PARK_OSR";
  }>;
  gcpList?: GroundControlPoint[];
  georeferencingRmsErrorM?: number;
  scannedSheetUrl?: string;
  historicalPlanData?: FmbPlanHistoricalDataset;
}

export type FmbTemporalEpoch =
  | "1967_FMB_SURVEY"
  | "1985_SUBDIVISION"
  | "2005_TSLR_DIGITAL"
  | "2026_SATELLITE_DETECTED"
  | "ALL_EPOCHS_OVERLAY";

export interface PlotCongruenceRecord {
  plotId: string;
  plotNumber: string;
  uprn: string;
  ownerName: string;
  area1967SqM: number;
  area1985SqM: number;
  area2005SqM: number;
  area2026SatelliteSqM: number;
  areaVarianceSqM: number;
  maxBoundaryShiftMeters: number;
  equallySketched: boolean; // within 0.25m tolerance
  driftType: "EQUALLY_SKETCHED" | "BOUNDARY_DRIFT" | "ROAD_ENCROACHMENT" | "OSR_ENCROACHMENT";
  complianceScore: number;
  boundary1967: [number, number][];
  boundary1985: [number, number][];
  boundary2005: [number, number][];
  boundary2026Satellite: [number, number][];
  legalBoundary: [number, number][];
  encroachmentPolygon?: [number, number][];
  gLineLadderOffsets?: Array<{
    chainageM: number;
    offsetM: number;
    direction: "L" | "R";
    station: string;
  }>;
  auditRemark: string;
}

export interface FmbPlanHistoricalDataset {
  planId: string;
  planName: string;
  surveyNumber: string;
  village: string;
  taluk: string;
  district: string;
  yearsCovered: string; // "1967 - 2026"
  gLine: {
    startCoord: [number, number];
    endCoord: [number, number];
    lengthMeters: number;
    azimuthDeg: number;
    ladderStations: Array<{ chainage: number; label: string; lat: number; lng: number }>;
  };
  plots: PlotCongruenceRecord[];
  totalPlots: number;
  equallySketchedCount: number;
  driftCount: number;
  encroachmentCount: number;
  congruenceIndexPercent: number;
}

export interface EncroachmentDiscrepancy {
  parcelId: string;
  uprn: string;
  ownerName: string;
  legalReference: string;
  approvalPlanNo: string;
  tier: string;
  encroachmentType:
    | "ROAD_RESERVE_VIOLATION"
    | "NEIGHBOR_BOUNDARY_DRIFT"
    | "OSR_ENCROACHMENT"
    | "UNAPPROVED_SUBDIVISION"
    | "CLEAR";
  encroachmentAreaSqM: number;
  maxDeviationMeters: number;
  legalBoundary: [number, number][];
  detectedPhysicalBoundary: [number, number][];
  encroachmentPolygon: [number, number][];
  vlmViolationNotice: string;
  complianceStatus: "VIOLATION_FLAGGED" | "COMPLIANT_APPROVED" | "PENDING_REGULARIZATION";
  timestamp: number;
}

export interface DroneScanEvent {
  event: string;
  frameIndex?: number;
  altitudeM?: number;
  gsdCm?: number;
  cannyEdgesDetected?: number;
  detectedFootprints?: number;
  timestamp?: number;
  message?: string;
}

export type IngestionMode = "VIRTUAL_UAV" | "LIVE_SATELLITE" | "CUSTOM_ORTHOMOSAIC";

export interface UAVTelemetry {
  latitude: number;
  longitude: number;
  altitude_agl: number;
  gsd_cm_px: number;
  rtk_status: "FIXED" | "FLOAT" | "SINGLE";
  satellites_tracked: number;
  heading_deg: number;
  speed_mps: number;
  battery_percent: number;
  zone: "URBAN" | "RURAL" | "COMMERCIAL";
  frame_index: number;
  canny_edges_detected?: number;
  contours_extracted?: number;
  ground_coverage_m?: { width: number; height: number };
  camera_footprint_bbox?: [number, number][];
  sensor_specs?: {
    sensor_width_mm: number;
    focal_length_mm: number;
    image_width_px: number;
    image_height_px: number;
  };
  timestamp: number;
}

export interface SatelliteBBoxResponse {
  status: string;
  source: string;
  bbox: [number, number, number, number];
  image_resolution: string;
  altitude_agl_m: number;
  gsd_cm_px: number;
  canny_edges_detected: number;
  raw_contours_found: number;
  vectorized_parcels_count: number;
  douglas_peucker_epsilon: number;
  parcels: Parcel[];
  timestamp: number;
}
