/**
 * Administrative Data Types for GeoTRACE-AI
 * Represents Tamil Nadu administrative hierarchy: District → Taluk → Village
 */

export interface District {
  id: string;
  code: string;
  name: string;
  nameTamil: string;
  state: string;
  geometry?: GeoJSONPolygon;
  source: string;
  sourceVersion: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Taluk {
  id: string;
  code: string;
  name: string;
  nameTamil: string;
  districtId: string;
  geometry?: GeoJSONPolygon;
  source: string;
  sourceVersion: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Village {
  id: string;
  code: string;
  name: string;
  nameTamil: string;
  districtId: string;
  talukId: string;
  geometry?: GeoJSONPolygon;
  villageType: 'REVENUE_VILLAGE' | 'TOWN_PANCHAYAT' | 'MUNICIPALITY' | 'CORPORATION';
  source: string;
  sourceVersion: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface AdministrativeGeometry {
  type: 'DISTRICT' | 'TALUK' | 'VILLAGE';
  id: string;
  name: string;
  geometry: GeoJSONPolygon;
  source: string;
  isApproximate: boolean;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface AdministrativeSelection {
  district?: District;
  taluk?: Taluk;
  village?: Village;
  level: 'DISTRICT' | 'TALUK' | 'VILLAGE' | 'NONE';
}