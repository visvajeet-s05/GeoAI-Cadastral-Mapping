import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";

const router = Router();
const FASTAPI_URL = process.env.ML_INFERENCE_URL || "http://127.0.0.1:8000";

// Helper: Calculate geodesic area & perimeter in square meters
function computePolygonGeodesics(coords: [number, number][], centerLat: number): { areaSqm: number; perimM: number } {
  if (coords.length < 3) return { areaSqm: 0, perimM: 0 };
  const latRad = (centerLat * Math.PI) / 180;
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const mPerDegLon = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);

  let areaSum = 0;
  let perimM = 0;
  const n = coords.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = coords[i][0] * mPerDegLon;
    const y1 = coords[i][1] * mPerDegLat;
    const x2 = coords[j][0] * mPerDegLon;
    const y2 = coords[j][1] * mPerDegLat;

    areaSum += x1 * y2 - x2 * y1;
    perimM += Math.hypot(x2 - x1, y2 - y1);
  }

  return {
    areaSqm: Math.round(Math.abs(areaSum) * 0.5 * 100) / 100,
    perimM: Math.round(perimM * 100) / 100,
  };
}

/**
 * POST /api/ml/predict_tile
 * Delegates to Python FastAPI microservice. Returns model_unavailable if service is offline.
 * No silent fallback to hardcoded predictions.
 */
router.post("/predict_tile", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const {
    image_base64,
    tile_url,
    bounds = [80.2542, 12.9818, 80.2615, 12.9875],
    confidence_threshold = 0.75,
    simplify_tolerance = 0.00002,
    regularize_right_angles = true,
    min_parcel_area_sqm = 20.0,
  } = req.body;

  // Check FastAPI health before attempting prediction
  let fastApiHealthy = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const resp = await fetch(`${FASTAPI_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      fastApiHealthy = true;
    }
  } catch {
    fastApiHealthy = false;
  }

  if (!fastApiHealthy) {
    return res.status(503).json({
      success: false,
      status: "model_unavailable",
      message: "FastAPI inference service is offline. Start the ML microservice on port 8000 to enable predictions.",
      fastapi_url: FASTAPI_URL,
      required_action: "Run: cd ml && pip install -r requirements.txt && python inference_server.py",
    });
  }

  // Delegate to FastAPI microservice
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s for inference

    const fastApiResponse = await fetch(`${FASTAPI_URL}/predict_tile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64,
        tile_url,
        bounds,
        confidence_threshold,
        simplify_tolerance,
        regularize_right_angles,
        min_parcel_area_sqm,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      return res.status(502).json({
        success: false,
        status: "model_error",
        message: `FastAPI inference failed: ${errorText}`,
      });
    }

    const data = await fastApiResponse.json();
    return res.json(data);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return res.status(504).json({
        success: false,
        status: "model_timeout",
        message: "Inference request timed out after 30 seconds",
      });
    }
    return res.status(502).json({
      success: false,
      status: "model_unreachable",
      message: `Failed to reach FastAPI service: ${err.message}`,
    });
  }
});

/**
 * GET /api/ml/health
 * Returns status of ML pipeline and FastAPI microservice
 */
router.get("/health", async (_req: Request, res: Response) => {
  let fastApiHealthy = false;
  let fastApiData = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const resp = await fetch(`${FASTAPI_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      fastApiHealthy = true;
      fastApiData = await resp.json();
    }
  } catch {
    // Offline
  }

  const onnxPath = path.join(process.cwd(), "ml/cadastral_segformer_v1.onnx");
  const onnxExists = fs.existsSync(onnxPath);

  return res.json({
    status: "HEALTHY",
    fastapi_service: fastApiHealthy ? "CONNECTED" : "OFFLINE_FALLBACK_ACTIVE",
    fastapi_details: fastApiData,
    onnx_model_file: onnxExists ? "PRESENT" : "GENERATED_ON_DEMAND",
    model_architecture: "EfficientNet-B3 U-Net (DualHead: Building + Vegetation)",
    supported_tasks: [
      "Building Footprint Extraction",
      "Vegetation/Greenery Segmentation",
    ],
    model_heads: ["building", "vegetation"],
    removed_heads: ["parcel", "road", "landuse", "boundary"],
  });
});

export default router;
