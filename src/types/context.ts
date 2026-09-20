/**
 * Land Context State Management for GeoTRACE-AI
 * Central state object for selected land context across all modules
 */

import { District, Taluk, Village } from './administrative';
import type { RecordAvailability, DataSource } from './records';

export interface SelectedLandContext {
  contextId: string;
  
  // Administrative hierarchy
  district?: {
    id: string;
    name: string;
    nameTamil?: string;
  };
  taluk?: {
    id: string;
    name: string;
    nameTamil?: string;
  };
  village?: {
    id: string;
    name: string;
    nameTamil?: string;
  };
  
  // Cadastral information
  surveyNumber?: string;
  subdivisionNumber?: string;
  
  // Geographic information
  center?: [number, number];
  boundingBox?: [number, number, number, number];
  
  // Area of Interest
  aoi?: {
    id: string;
    name: string;
    geometry: GeoJSONPolygon;
    geometrySource: string;
    confidence: number;
    isApproximate: boolean;
  };
  
  // Selected parcel
  selectedParcel?: string;
  
  // Data availability
  dataAvailability: RecordAvailability[];
  
  // Source metadata
  sourceMetadata: DataSource[];
  
  // Free search results
  freeSearchResult?: {
    query: string;
    resolvedLocation: [number, number];
    resolvedDistrict?: string;
    resolvedTaluk?: string;
    resolvedVillage?: string;
    confidence: number;
  };
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ContextUpdateAction {
  type: 'SET_DISTRICT' | 'SET_TALUK' | 'SET_VILLAGE' | 'SET_SURVEY' | 'SET_SUBDIVISION' | 'SET_AOI' | 'SET_FREE_SEARCH' | 'CLEAR_CONTEXT';
  payload: any;
}

export interface AdministrativeSearchState {
  districts: District[];
  taluks: Taluk[];
  villages: Village[];
  selectedDistrict: District | null;
  selectedTaluk: Taluk | null;
  selectedVillage: Village | null;
  isLoading: boolean;
  error: string | null;
}

export interface MapLayerConfig {
  id: string;
  name: string;
  type: 'ADMINISTRATIVE' | 'CADASTRAL' | 'PHYSICAL' | 'AI' | 'DISCREPANCY';
  visible: boolean;
  style: {
    color: string;
    weight: number;
    fillOpacity: number;
    dashArray?: number[];
  };
  source: string;
  zIndex: number;
}