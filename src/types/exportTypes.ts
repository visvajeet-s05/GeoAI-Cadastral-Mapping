/**
 * GeoTrace-AI Official Survey & CAD Export Engine Types
 * Day 3: LandXML v1.2, AutoCAD DXF, and Statutory PDF Audit Certificate Types
 */

import { Parcel, ParcelStatus } from "../types";

export interface SurveyMetadata {
  surveyorName?: string;
  surveyorCredentials?: string;
  surveyorLicenseNumber?: string;
  surveyCompany?: string;
  date?: string; // YYYY-MM-DD
  state?: string;
  district?: string;
  taluk?: string;
  village?: string;
  surveyNumber?: string;
  subDivision?: string;
  crsName?: string; // e.g. "EPSG:32644 - WGS 84 / UTM zone 44N"
  utmZone?: number; // default 44 for Tamil Nadu
  notes?: string;
}

export interface ParcelFeature extends Partial<Parcel> {
  id: string;
  uprn: string;
  coordinates: [number, number][];
  calculatedAreaSqMeters: number;
  perimeterMeters?: number;
  ownerName?: string;
  hasSelfIntersection?: boolean;
  hasOverlap?: boolean;
  legalBoundaryCoordinates?: [number, number][];
  [key: string]: any;
}

export interface DXFExportOptions {
  utmZone?: number;
  includeTextLabels?: boolean;
  includeVertexPegs?: boolean;
  useLocalCoordinates?: boolean; // offset to centroid for readable CAD origin
}

export interface DiscrepancyCertificateOptions {
  surveyorName?: string;
  surveyorLicense?: string;
  revenueInspector?: string;
  tahsildarOfficer?: string;
  watermarkText?: string;
  includeAerialSnapshot?: boolean;
}
