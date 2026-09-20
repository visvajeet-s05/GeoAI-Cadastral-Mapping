/**
 * Document Types and Data Models for GeoTRACE-AI Phase 2
 * Document ingestion, processing, and storage
 */

export type DocumentType =
  | 'FMB_SKETCH'
  | 'F_LINE_SKETCH'
  | 'TSLR'
  | 'TSLR_SKETCH'
  | 'TSLR_EXTRACT'
  | 'PATTA'
  | 'CHITTA'
  | 'A_REGISTER'
  | 'ADANGAL'
  | 'PATTA_ORDER'
  | 'SURVEY_RECORD'
  | 'SUBDIVISION_RECORD'
  | 'APPROVED_LAYOUT'
  | 'MASTER_PLAN'
  | 'DEVELOPMENT_PERMISSION'
  | 'REGISTRATION_EC'
  | 'HISTORICAL_RECORD'
  | 'UAV_ORTHOPHOTO'
  | 'UAV_IMAGE'
  | 'GEOREFERENCED_IMAGE';

export type DocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'OCR_EXTRACTED'
  | 'GEOMETRY_EXTRACTED'
  | 'GEOREFERENCED'
  | 'VALIDATED'
  | 'FAILED'
  | 'REQUIRES_REVIEW';

export type ProcessingStep =
  | 'UPLOAD'
  | 'OCR'
  | 'GEOMETRY_EXTRACTION'
  | 'GEOREFERENCING'
  | 'VALIDATION'
  | 'COMPLETED';

export type FileFormat =
  | 'PDF'
  | 'JPG'
  | 'PNG'
  | 'TIFF'
  | 'GEOJSON'
  | 'SHAPEFILE'
  | 'CSV'
  | 'KML'
  | 'KMZ'
  | 'GEOTIFF';

export type GovernmentSource =
  | 'TAMILNILAM'
  | 'TAMILNILAM_URBAN'
  | 'CLA_COMMISSIONERATE'
  | 'SURVEY_LAND_RECORDS'
  | 'TNGIS'
  | 'CMDA'
  | 'DTCP'
  | 'TNREGINET'
  | 'E_ADANGAL'
  | 'RURAL_DEVELOPMENT'
  | 'MUNICIPALITY'
  | 'CORPORATION'
  | 'USER_UPLOADED'
  | 'UNKNOWN';

export interface DocumentMetadata {
  documentId: string;
  documentType: DocumentType;
  fileFormat: FileFormat;
  fileName: string;
  originalName?: string;
  fileSize: number;
  uploadedAt: number;
  uploadedBy: string;
  
  // Administrative Context
  district?: string;
  districtId?: string;
  taluk?: string;
  talukId?: string;
  village?: string;
  villageId?: string;
  surveyNumber?: string;
  subdivisionNumber?: string;
  
  // Document Information
  documentReference?: string;
  documentYear?: number;
  source: GovernmentSource;
  sourceUrl?: string;
  sourceOrganization: string;
  accessMethod: 'API' | 'MANUAL_UPLOAD' | 'AUTHORIZED_IMPORT' | 'REQUIRES_AUTHORIZATION';
  
  // Technical Information
  coordinateSystem?: string;
  projection?: string;
  scale?: string;
  orientation?: string;
  dpi?: number;
  
  // Processing Status
  status: DocumentStatus;
  processingSteps: ProcessingStep[];
  processingErrors?: string[];
  versionHistory?: DocumentVersion[];
  
  // Storage
  filePath: string;
  thumbnailPath?: string;
  
  // Extracted Data (populated after processing)
  extractedText?: string;
  extractedGeometry?: GeoJSONPolygon;
  extractedDimensions?: {
    widthMeters?: number;
    heightMeters?: number;
    areaSqMeters?: number;
    perimeterMeters?: number;
  };
  extractedSurveyNumber?: string;
  extractedSubdivision?: string;
  extractedNeighbors?: string[];
  
  // Georeferencing
  georeferencing?: {
    gcpCount: number;
    transformation: 'AFFINE' | 'TPS' | 'PROJECTIVE';
    rmsErrorMeters: number;
    maxResidualMeters: number;
    status: 'ACCEPTABLE' | 'REVIEW_REQUIRED' | 'FAILED';
  };
  
  // Quality Assessment
  qualityScore?: number; // 0-1
  confidenceScore?: number; // 0-1
  verificationStatus: 'PENDING' | 'AI_GENERATED' | 'HUMAN_VERIFIED' | 'REJECTED';
  
  // Provenance
  isSimulated: boolean;
  notes?: string;
}

export interface DocumentVersion {
  version: number;
  timestamp: number;
  uploadedBy: string;
  notes: string;
  status: DocumentStatus;
}

export interface DocumentUploadRequest {
  documentType: DocumentType;
  file: File;
  metadata: {
    district?: string;
    districtId?: string;
    taluk?: string;
    talukId?: string;
    village?: string;
    villageId?: string;
    surveyNumber?: string;
    subdivisionNumber?: string;
    documentYear?: number;
    documentReference?: string;
    source: GovernmentSource;
    coordinateSystem?: string;
    scale?: string;
    orientation?: string;
  };
}

export interface DocumentProcessingResult {
  documentId: string;
  status: DocumentStatus;
  extractedData?: {
    text?: string;
    geometry?: GeoJSONPolygon;
    dimensions?: {
      widthMeters?: number;
      heightMeters?: number;
      areaSqMeters?: number;
      perimeterMeters?: number;
    };
    surveyNumber?: string;
    subdivision?: string;
    neighbors?: string[];
  };
  georeferencing?: {
    transformation: string;
    rmsErrorMeters: number;
    gcpCount: number;
  };
  errors?: string[];
  warnings?: string[];
  qualityScore?: number;
  confidenceScore?: number;
}

export interface GroundControlPoint {
  id: string;
  pixelX: number;
  pixelY: number;
  targetLat: number;
  targetLng: number;
  residualMeters?: number;
  description?: string;
}

export interface GeoreferencingRequest {
  documentId: string;
  gcps: GroundControlPoint[];
  transformation: 'AFFINE' | 'TPS' | 'PROJECTIVE';
}

export interface GeoreferencingResult {
  documentId: string;
  transformation: string;
  rmsErrorMeters: number;
  maxResidualMeters: number;
  gcpCount: number;
  status: 'ACCEPTABLE' | 'REVIEW_REQUIRED' | 'FAILED';
  transformedGeometry?: GeoJSONPolygon;
  residuals: Array<{
    gcpId: string;
    residualMeters: number;
  }>;
}

export interface HistoricalRecord {
  recordId: string;
  documentId: string;
  year: number;
  documentType: DocumentType;
  geometry?: GeoJSONPolygon;
  areaSqMeters?: number;
  boundary?: [number, number][];
  surveyNumber?: string;
  subdivision?: string;
  extent?: string;
  source: GovernmentSource;
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  verificationStatus: 'AI_GENERATED' | 'HUMAN_VERIFIED' | 'REJECTED';
  confidenceScore: number;
  notes?: string;
}

export interface TemporalChange {
  fromYear: number;
  toYear: number;
  changeType: 'UNCHANGED' | 'MODIFIED' | 'SUBDIVIDED' | 'MERGED' | 'POSSIBLE_CHANGE' | 'UNKNOWN';
  areaChangeSqMeters?: number;
  areaChangePercent?: number;
  boundaryShiftMeters?: number;
  buildingChange?: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'NONE';
  confidence: number;
  requiresVerification: boolean;
}

export interface TimelineNode {
  year: number;
  hasData: boolean;
  recordTypes: DocumentType[];
  documentCount: number;
  quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
}

export interface GovernmentImportConfig {
  source: GovernmentSource;
  sourceUrl?: string;
  sourceOrganization: string;
  requiresAuthorization: boolean;
  availableRecordTypes: DocumentType[];
  importMethod: 'API' | 'MANUAL_UPLOAD' | 'BATCH_CSV' | 'BATCH_PDF';
  documentationUrl?: string;
  lastChecked?: number;
  status: 'AVAILABLE' | 'PARTIAL' | 'REQUIRES_AUTHORIZATION' | 'NOT_AVAILABLE';
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ImportBatch {
  batchId: string;
  source: GovernmentSource;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  startedAt: number;
  completedAt?: number;
  errors?: string[];
}

export interface ValidationRule {
  ruleId: string;
  ruleName: string;
  ruleType: 'FORMAT' | 'ADMINISTRATIVE' | 'GEOMETRIC' | 'DUPLICATE';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  description: string;
  validator: (data: any) => { valid: boolean; message?: string };
}

export interface ValidationResult {
  documentId: string;
  isValid: boolean;
  errors: Array<{
    ruleId: string;
    ruleName: string;
    message: string;
  }>;
  warnings: Array<{
    ruleId: string;
    ruleName: string;
    message: string;
  }>;
  qualityScore: number;
}

export interface FmbOcrResult {
  surveyNumber?: string;
  subdivision?: string;
  areaSqMeters?: number;
  perimeterMeters?: number;
  widthMeters?: number;
  heightMeters?: number;
  neighbors?: string[];
  fieldBookRefs?: string[];
  gLineRefs?: string[];
  ocrText: string;
  confidenceScore: number;
  modelUsed: string;
}

export interface ExtractedBoundary {
  surveyNumber: string;
  subdivision: string;
  coordinates: [number, number][];
  areaSqMeters: number;
  perimeterMeters: number;
  centroid: { lat: number; lng: number };
}

export interface FmbProcessingResult {
  documentId: string;
  ocrResult: FmbOcrResult;
  boundaryExtraction?: {
    transformation: 'AFFINE' | 'TPS' | 'PROJECTIVE';
    rmsErrorMeters: number;
    gcpCount: number;
    status: 'ACCEPTABLE' | 'REVIEW_REQUIRED' | 'FAILED';
  };
  boundaries: ExtractedBoundary[];
  georeferencing?: {
    gcpCount: number;
    transformation: 'AFFINE' | 'TPS' | 'PROJECTIVE';
    rmsErrorMeters: number;
    maxResidualMeters: number;
    status: 'ACCEPTABLE' | 'REVIEW_REQUIRED' | 'FAILED';
    affineMatrix?: number[][];
  };
  qualityScore: number;
  confidenceScore: number;
  processingTimeMs: number;
}

export interface GovernmentImportBatch {
  batchId: string;
  source: GovernmentSource;
  recordTypes: DocumentType[];
  surveyNumber: string;
  district: string;
  taluk: string;
  village: string;
  uploadId?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  progress: number;
  errors: string[];
  results: any[];
  startedAt: number;
  completedAt?: number;
}

export interface TnreginetRecord {
  documentNumber: string;
  registrationYear: number;
  registrationDate: string;
  documentType: 'REGISTRATION_EC' | 'SALE_DEED' | 'GIFT_DEED' | 'PARTITION_DEED';
  parties: Array<{ name: string; type: string }>;
  propertyDetails: {
    surveyNumber: string;
    subDivision?: string;
    village: string;
    district: string;
    taluk: string;
    areaSqMeters?: number;
  };
  registrationFees: number;
  status: 'REGISTERED' | 'PENDING' | 'CANCELLED';
  registrarOffice: string;
  source: 'TNREGINET';
  verified: boolean;
}

export interface TimelineEpoch {
  year: number;
  hasData: boolean;
  recordTypes: DocumentType[];
  documentCount: number;
  quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
  source?: string;
  georeferencing?: {
    rmsErrorM: number;
    status: string;
  };
}

export interface TemporalComparisonResult {
  plotId: string;
  uprn: string;
  ownerName: string;
  fromYear: number;
  toYear: number;
  fromEpoch: string;
  toEpoch: string;
  fromCoordinates: [number, number][];
  toCoordinates: [number, number][];
  vertexDisplacementsMeters: number[];
  maxDisplacementMeters: number;
  meanDisplacementMeters: number;
  areaChangeSqMeters: number;
  areaChangePercent: number;
  equallySketched: boolean;
  driftType: string;
  auditRemark: string;
}

export interface FmbOverlayGeometry {
  boundaries: [number, number][][];
  surveyNumbers: Array<{ surveyNumber: string; subdivision?: string }>;
  gLine?: {
    startCoord: [number, number];
    endCoord: [number, number];
    lengthMeters: number;
    azimuthDeg: number;
    ladderStations: Array<{ chainage: number; label: string; lat: number; lng: number }>;
  };
  georeferencingRmsErrorM?: number;
}