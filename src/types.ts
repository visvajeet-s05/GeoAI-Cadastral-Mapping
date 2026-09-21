export type LandType =
  | "RESIDENTIAL"
  | "COMMERCIAL"
  | "AGRICULTURAL"
  | "INDUSTRIAL"
  | "UNCLAIMED"
  | "PUBLIC_INFRASTRUCTURE";

// Import new administrative and record types
export type { District, Taluk, Village, AdministrativeGeometry, AdministrativeSelection } from './types/administrative';
export type { 
  RecordAvailabilityStatus, 
  RecordType, 
  GeometrySource, 
  VerificationStatus, 
  DataSource, 
  LandRecord, 
  RecordAvailability, 
  LandRecordContext,
  MeasurementTypes,
  DiscrepancyType,
  DiscrepancyAnalysis 
} from './types/records';
export type { 
  SelectedLandContext, 
  ContextUpdateAction, 
  AdministrativeSearchState, 
  MapLayerConfig 
} from './types/context';
export type { 
  DocumentType, 
  DocumentStatus, 
  GovernmentSource, 
  DocumentUploadRequest,
  DocumentMetadata,
  DocumentVersion,
  DocumentProcessingResult,
  ProcessingStep,
  FileFormat,
  GeoreferencingRequest,
  GeoreferencingResult,
  HistoricalRecord,
  TimelineNode,
  TemporalChange,
  GovernmentImportConfig,
  GeoJSONPolygon,
  ImportBatch,
  ValidationRule,
  ValidationResult,
  FmbOcrResult,
  ExtractedBoundary,
  FmbProcessingResult,
  GovernmentImportBatch,
  TnreginetRecord,
  TimelineEpoch,
  TemporalComparisonResult,
  FmbOverlayGeometry
} from './types/documents';
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
  // Tamil Nadu Cadastral Hierarchy & Historical Provenance
  state?: string;
  district?: string;
  taluk?: string;
  village?: string;
  surveyNumber?: string;
  subDivision?: string;
  historicalYear?: number;
  historicalSource?: string;
  historicalAreaSqM?: number;
  // High-Precision Architectural & Satellite Footprint
  buildingFootprint?: [number, number][];
  buildingDetails?: {
    buildingName?: string;
    roofType?: string;
    floors?: number;
    builtUpAreaSqM?: number;
    setbackFrontM?: number;
    setbackRearM?: number;
    setbackLeftM?: number;
    setbackRightM?: number;
  };
  compoundWall?: [number, number][];
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
  uncertaintyBands: boolean;
  zoningColors: boolean;
  topologyIssues: boolean;
  satelliteBasemap: boolean;
  legalGovLayout?: boolean;
  discrepancyOverlay?: boolean;
  gcpControlPoints?: boolean;
  // Tamil Nadu Historical vs Drone Analysis Layers
  historicalParcels?: boolean;
  droneCoverage?: boolean;
  detectedBuildings?: boolean;
  detectedOpenAreas?: boolean;
  detectedRoads?: boolean;
  boundaryCandidates?: boolean;
  dronePosition?: boolean;
  cameraFootprint?: boolean;
  visualComparisonMode?: VisualComparisonMode;
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

export interface GovLayoutRecord {
  id: string;
  tier: "FMB_TSLR" | "CMDA_LAYOUT" | "DTCP_LAYOUT";
  title: string;
  approvalNo: string;
  year: number;
  district: string;
  taluk: string;
  village: string;
  centerCoordinates?: { lat: number; lng: number };
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
  surveyNo?: string; // Alternative survey number field
  village: string;
  taluk: string;
  district: string;
  yearsCovered: string; // "1967 - 2026"
  gLine: {
    startCoord: [number, number];
    endCoord: [number, number];
    lengthMeters: number;
    azimuthDeg: number;
    ladderStations: Array<{ 
      chainage: number; 
      label: string; 
      lat: number; 
      lng: number;
      offsetLeftMeters?: number;
      offsetRightMeters?: number;
      groundVerified2026?: boolean;
    }>;
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

// ==========================================
// TAMIL NADU HISTORICAL & DRONE INTELLIGENCE
// ==========================================

export type ProvenanceCategory = "OBSERVED" | "DERIVED" | "INFERRED" | "UNKNOWN";
export type ConfidenceStatus = "CONFIRMED" | "PROBABLE" | "UNCERTAIN" | "UNAVAILABLE";

export type DetectionType =
  | "BUILDING"
  | "ROAD"
  | "OPEN_AREA"
  | "BOUNDARY_CANDIDATE"
  | "UNKNOWN";

export interface AIDetection {
  id: string; // e.g. "BLD-01", "OPEN-01", "ROAD-01", "BND-01"
  type: DetectionType;
  confidence: number; // 0.0 - 1.0
  status: ConfidenceStatus;
  geometry: [number, number][]; // GeoJSON [[lng, lat], ...]
  areaSqM: number;
  perimeterM: number;
  historicalParcelId?: string;
  historicalSurveyNumber?: string;
  overlapPercentage?: number;
  crossesBoundary?: boolean;
  crossingParcelIds?: string[];
  droneSurveyId: string;
  frameId?: string;
  timestamp: number;
  provenance: "OBSERVED" | "DERIVED";
  humanVerified?: boolean;
  notes?: string;
}

export interface GroundControlPointRecord {
  id: string;
  name: string;
  pixelX: number;
  pixelY: number;
  targetLat: number;
  targetLng: number;
  residualMeters: number;
}

export interface HistoricalDocument {
  id: string;
  documentType:
    | "FMB_SKETCH"
    | "TSLR_MAP"
    | "VILLAGE_CADASTRAL"
    | "LAYOUT_PLAN"
    | "PLOT_BLUEPRINT";
  title: string;
  source: string; // e.g., "Tamil Nadu Survey & Land Records (eservices.tn.gov.in)"
  year: number;
  state: string;
  district: string;
  taluk: string;
  village: string;
  surveyNumber: string;
  subDivision?: string;
  scale?: string;
  orientation?: string;
  georeferencing: {
    controlPoints: GroundControlPointRecord[];
    transformation: "AFFINE";
    rmsErrorM: number;
    status: "ACCEPTABLE" | "REVIEW_REQUIRED";
  };
  parcelsExtracted?: number;
  rawImageUrl?: string;
  processedImageUrl?: string;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "REJECTED";
}

export interface ParcelSpatialAnalysis {
  parcelId: string;
  uprn: string;
  surveyNumber: string;
  subDivision: string;
  state: string;
  district: string;
  taluk: string;
  village: string;
  historicalYear: number;
  historicalSource: string;
  historicalAreaSqM: number;
  currentBuildingAreaSqM: number;
  currentOpenAreaSqM: number;
  currentRoadAreaSqM: number;
  unclassifiedAreaSqM: number;
  buildingCoveragePercent: number;
  openAreaPercent: number;
  boundaryAlignmentPercent: number;
  detectedBuildingsCount: number;
  associatedBuildings: Array<{
    buildingId: string;
    overlapPercent: number;
    areaSqM: number;
    confidence: number;
    crossesBoundary: boolean;
    crossingParcels?: string[];
  }>;
  changeCandidates: Array<{
    type:
      | "BUILT_UP_CHANGE"
      | "OPEN_AREA_CHANGE"
      | "BOUNDARY_DRIFT_CANDIDATE"
      | "SUBDIVISION_CANDIDATE"
      | "MERGE_CANDIDATE";
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    confidence: number;
    status: "PROBABLE" | "CONFIRMED" | "UNDER_REVIEW";
  }>;
  provenanceBreakdown: {
    observed: string[];
    derived: string[];
    inferred: string[];
    unknown: string[];
  };
  georeferencingQuality: "HIGH" | "MEDIUM" | "LOW";
  aiConfidence: "HIGH" | "MEDIUM" | "LOW";
  overallAnalysisStatus: "CONFIRMED" | "REVIEW_RECOMMENDED" | "UNCERTAIN";
  disclaimer: string;
}

export type VisualComparisonMode =
  | "OVERLAY"
  | "HISTORICAL_ONLY"
  | "CURRENT_ONLY"
  | "SWIPE_COMPARISON";

export interface TamilNaduHierarchyNode {
  district: string;
  taluks: {
    name: string;
    villages: {
      name: string;
      surveyNumbers: {
        number: string;
        subDivisions: string[];
        center: [number, number]; // [lat, lng]
      }[];
    }[];
  }[];
}

// ==========================================
// DUAL-STREAM CADASTRAL AI ARCHITECTURE TYPES
// ==========================================

export type HomographyMatrix = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export interface CoRegistrationResult {
  homography_matrix: HomographyMatrix;
  mean_alignment_error_meters: number;
  confidence_score: number;
  inliers_count?: number;
  tps_residual_rms?: number;
}

export interface DualStreamBoundaryNode {
  node_id: string;
  lat: number;
  lon: number;
  confidence: number;
  displacement_meters: number;
  source_feature?: "SURVEY_STONE" | "T_JUNCTION" | "FENCE_CORNER" | "WALL_CURB";
}

export interface DualStreamParcel {
  parcel_id: string;
  survey_number: string;
  blueprint_annotated_area_sqm: number;
  reconstructed_area_sqm: number;
  area_discrepancy_sqm: number;
  discrepancy_flag: boolean;
  boundary_nodes: DualStreamBoundaryNode[];
  geojson_geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

export interface DualStreamPriorityReviewItem {
  node_id: string;
  parcel_index?: number;
  issue_type:
    | "PHYSICAL_INCROACHMENT_OR_DISPLACEMENT"
    | "PHYSICAL_ENCROACHMENT_OR_DISPLACEMENT"
    | "SHARED_EDGE_DISPARITY"
    | "OCR_DIMENSION_MISMATCH"
    | "EPISTEMIC_UNCERTAINTY_HOTSPOT";
  blueprint_offset_m: number;
  drone_measured_m: number;
  displacement_meters?: number;
  priority_score: number; // P_i = α*d_Chamfer + β*|D_bp - D_dr| + γ*σ_epi^2
  status?: "FLAGGED_FOR_HUMAN_REVIEW" | "RESOLVED" | "SURVEYOR_OVERRIDDEN";
}

export interface DualStreamConnectivityAudit {
  total_nodes_evaluated: number;
  shared_edges_verified: number;
  topological_overlaps_detected: number;
  topological_gaps_detected: number;
  priority_review_queue: DualStreamPriorityReviewItem[];
}

export interface DualStreamVerificationResult {
  system_status: "SUCCESS" | "WARNING" | "FAILED";
  co_registration: CoRegistrationResult;
  parcels: DualStreamParcel[];
  connectivity_audit: DualStreamConnectivityAudit;
  raw_gemini_response?: string;
  generated_at?: number;
  cryptographic_hash?: string;
}

export interface StreamAState {
  rawScanLoaded: boolean;
  otsuBinarized: boolean;
  skeletonized: boolean;
  gLinesExtracted: boolean;
  fLinesExtracted: boolean;
  ocrMasked: boolean;
  activeFilter: "RAW" | "OTSU" | "SKELETON" | "VECTOR_OVERLAY";
}

export interface StreamBState {
  rtspLive: boolean;
  sam2Segmented: boolean;
  yoloSegEdges: boolean;
  physicalWallsExtracted: boolean;
  activeFilter: "RGB" | "SAM2_MASK" | "YOLO_SEG" | "EDGE_OVERLAY";
}

