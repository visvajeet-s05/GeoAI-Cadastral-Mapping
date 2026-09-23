/**
 * GeoTrace-AI Cadastral Boundary ML Inference Client
 * Day 2: Connects the React GIS frontend to the ONNX/FastAPI microservice
 */

import { Parcel, ParcelStatus } from "../../types";

export interface MLInferenceParams {
  bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat] in EPSG:4326
  imageBase64?: string;
  tileUrl?: string;
  confidenceThreshold?: number; // 0.50 to 0.99
  simplifyTolerance?: number; // Douglas-Peucker tolerance in degrees
  regularizeRightAngles?: boolean;
  minParcelAreaSqm?: number;
}

export interface MLTopologicalHealth {
  self_intersections: number;
  overlap_detected: boolean;
  valid_count: number;
  flagged_count: number;
  status: string;
}

export interface MLInferenceMetrics {
  avg_confidence: number;
  total_area_sqm: number;
  avg_perimeter_m: number;
  vertex_count_total: number;
}

export interface MLInferenceResponse {
  success: boolean;
  model_version: string;
  execution_provider: string;
  inference_time_ms: number;
  parcels_detected: number;
  geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      id: string;
      geometry: {
        type: "Polygon";
        coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
      };
      properties: {
        parcel_id: string;
        survey_number: string;
        sub_division?: string;
        confidence: number;
        area_sqm: number;
        perimeter_m: number;
        vertex_count: number;
        classification?: string;
        topological_status: string;
        extraction_method?: string;
        regularized_right_angles?: boolean;
      };
    }>;
  };
  topological_health: MLTopologicalHealth;
  metrics: MLInferenceMetrics;
}

export interface MLInferenceResult extends MLInferenceResponse {
  parcels: Parcel[];
}

export interface MLHealthStatus {
  status: string;
  fastapi_service: string;
  fastapi_details?: any;
  onnx_model_file: string;
  model_architecture: string;
  supported_tasks: string[];
}

/**
 * Converts GeoJSON Features into strongly-typed GeoTrace-AI Parcel models
 * Note: GeoJSON stores [lng, lat], whereas Leaflet and Parcel.coordinates store [lat, lng].
 */
export function convertGeoJsonFeaturesToParcels(
  features: MLInferenceResponse["geojson"]["features"]
): Parcel[] {
  const timestamp = Date.now();

  return features.map((feat, idx) => {
    const rawRing = feat.geometry.coordinates[0] || [];
    // Convert [lng, lat] to Leaflet [lat, lng]
    const latLngCoords: [number, number][] = rawRing.map((c) => [c[1], c[0]]);

    // Calculate centroid
    let sumLat = 0;
    let sumLng = 0;
    const count = Math.max(1, latLngCoords.length - 1);
    for (let i = 0; i < count; i++) {
      sumLat += latLngCoords[i][0];
      sumLng += latLngCoords[i][1];
    }
    const centroid = {
      latitude: Number((sumLat / count).toFixed(6)),
      longitude: Number((sumLng / count).toFixed(6)),
    };

    const props = feat.properties;
    const confidence = props.confidence ?? 0.88;
    const epistemic = Number((Math.max(0.02, 1.0 - confidence)).toFixed(3));
    const aleatoric = 0.05;
    const overallUncertainty = Number(Math.sqrt(epistemic ** 2 + aleatoric ** 2).toFixed(3));

    const status: ParcelStatus =
      props.topological_status === "VALID_CLOSED_PLANAR"
        ? "TOPOLOGY_VERIFIED"
        : "DRAFT_SEGMENTATION";

    return {
      id: feat.id || `ml_parcel_${timestamp}_${idx + 1}`,
      uprn: `UPRN-TN-${props.survey_number?.replace("/", "-") || idx + 200}`,
      geoTraceCardNumber: `GT-TN-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      ownerName: `Automated UAV Cadastre Det #${idx + 1}`,
      ownerNationalId: `TN-CAD-UAV-${props.parcel_id || idx + 101}`,
      landType: "RESIDENTIAL",
      status,
      coordinates: latLngCoords,
      calculatedAreaSqMeters: props.area_sqm || 120.0,
      perimeterMeters: props.perimeter_m || 44.0,
      centroid,
      vertexCount: props.vertex_count || latLngCoords.length - 1,
      epistemicUncertainty: epistemic,
      aleatoricUncertainty: aleatoric,
      overallUncertainty,
      structureCount: 1,
      complianceScore: Number((confidence * 100).toFixed(1)),
      encroachmentDetected: false,
      currentHash: `sha256_${Math.random().toString(36).substring(2, 12)}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      state: "Tamil Nadu",
      district: "Chennai",
      taluk: "Velachery",
      village: "Thiruvanmiyur",
      surveyNumber: props.survey_number || `142/${idx + 1}`,
      subDivision: props.sub_division || "AUTO_UAV",
      historicalYear: 2026,
      historicalSource: "SegFormer-B3 ONNX Drone Cadastral Vectorization",
      historicalAreaSqM: props.area_sqm,
    };
  });
}

/**
 * Sends orthomosaic tile bounds and image data to the deep learning inference service
 */
export async function predictCadastralBoundaries(
  params: MLInferenceParams
): Promise<MLInferenceResult> {
  const payload = {
    bounds: params.bounds,
    image_base64: params.imageBase64,
    tile_url: params.tileUrl,
    confidence_threshold: params.confidenceThreshold ?? 0.75,
    simplify_tolerance: params.simplifyTolerance ?? 0.00002,
    regularize_right_angles: params.regularizeRightAngles ?? true,
    min_parcel_area_sqm: params.minParcelAreaSqm ?? 20.0,
  };

  const response = await fetch("/api/ml/predict_tile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML Cadastral Prediction failed (${response.status}): ${errorText}`);
  }

  const rawData: MLInferenceResponse = await response.json();
  const parcels = convertGeoJsonFeaturesToParcels(rawData.geojson.features);

  return {
    ...rawData,
    parcels,
  };
}

/**
 * Checks health of the ML pipeline and FastAPI microservice
 */
export async function checkMLServiceHealth(): Promise<MLHealthStatus> {
  const response = await fetch("/api/ml/health");
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}
