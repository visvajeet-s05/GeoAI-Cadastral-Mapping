/**
 * Land Record Types and Data Source Registry for GeoTRACE-AI
 * Maintains separate record types and provenance tracking
 */

export type RecordAvailabilityStatus = 
  | 'AVAILABLE' 
  | 'PARTIAL' 
  | 'REQUIRES_IMPORT' 
  | 'REQUIRES_AUTHORIZATION' 
  | 'NOT_AVAILABLE' 
  | 'NOT_APPLICABLE';

export type RecordType = 
  | 'PATTA' 
  | 'CHITTA' 
  | 'A_REGISTER' 
  | 'FMB_SKETCH' 
  | 'F_LINE_SKETCH' 
  | 'TSLR' 
  | 'TSLR_SKETCH' 
  | 'TSLR_EXTRACT' 
  | 'PATTA_ORDER' 
  | 'SURVEY_RECORD' 
  | 'SUBDIVISION_RECORD' 
  | 'APPROVED_LAYOUT' 
  | 'ADANGAL' 
  | 'REGISTRATION_EC' 
  | 'HISTORICAL_RECORD';

export type GeometrySource = 
  | 'GOVERNMENT_CADASTRAL' 
  | 'FMB' 
  | 'TSLR' 
  | 'UAV' 
  | 'AI_RECONSTRUCTED' 
  | 'USER_UPLOADED' 
  | 'SIMULATED';

export type VerificationStatus = 
  | 'AI_GENERATED' 
  | 'PENDING_REVIEW' 
  | 'HUMAN_VERIFIED' 
  | 'REJECTED' 
  | 'NEEDS_FIELD_SURVEY';

export interface DataSource {
  sourceId: string;
  sourceName: string;
  organization: string;
  sourceType: 'OFFICIAL' | 'MUNICIPAL' | 'DEPARTMENTAL' | 'SIMULATED';
  accessMethod: 'API' | 'MANUAL' | 'PORTAL' | 'AUTHORIZED';
  status: RecordAvailabilityStatus;
  sourceUrl?: string;
  license?: string;
  lastChecked?: string;
  notes?: string;
}

export interface LandRecord {
  recordId: string;
  recordType: RecordType;
  source: string;
  sourceUrl?: string;
  sourceOrganization: string;
  retrievalDate: string;
  recordDate: string;
  status: RecordAvailabilityStatus;
  documentReference?: string;
  geometry?: GeoJSONPolygon;
  filePath?: string;
  verificationStatus: VerificationStatus;
  isSimulated: boolean;
  metadata?: Record<string, any>;
}

export interface RecordAvailability {
  recordType: RecordType;
  status: RecordAvailabilityStatus;
  source?: string;
  lastUpdated?: string;
  notes?: string;
}

export interface LandRecordContext {
  contextId: string;
  district?: {
    id: string;
    name: string;
  };
  taluk?: {
    id: string;
    name: string;
  };
  village?: {
    id: string;
    name: string;
  };
  surveyNumber?: string;
  subdivisionNumber?: string;
  selectedGeometry?: GeoJSONPolygon;
  center?: [number, number];
  boundingBox?: [number, number, number, number];
  aoi?: {
    id: string;
    name: string;
    geometry: GeoJSONPolygon;
    geometrySource: string;
    confidence: number;
    isApproximate: boolean;
  };
  selectedParcel?: string;
  dataAvailability: RecordAvailability[];
  sourceMetadata: DataSource[];
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface MeasurementTypes {
  plotAreaSqFt?: number;
  buildingGroundFootprintSqFt?: number;
  builtUpAreaSqFt?: number;
  floorWiseBuiltUpAreaSqFt?: number;
  permissibleBuiltUpAreaSqFt?: number;
  fsi?: number;
  openSpaceAreaSqFt?: number;
}

export type DiscrepancyType = 
  | 'POTENTIAL_AREA_MISMATCH'
  | 'POTENTIAL_BOUNDARY_SHIFT'
  | 'POTENTIAL_BUILDING_OVERLAP'
  | 'POTENTIAL_ENCROACHMENT'
  | 'RECORD_CONFLICT'
  | 'PHYSICAL_CHANGE'
  | 'UNVERIFIED_CHANGE'
  | 'REQUIRES_FIELD_SURVEY';

export interface DiscrepancyAnalysis {
  discrepancyType: DiscrepancyType;
  recordedValue: number;
  observedValue: number;
  difference: number;
  percentageDifference: number;
  measurementType: keyof MeasurementTypes;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresVerification: boolean;
  evidence?: string[];
}