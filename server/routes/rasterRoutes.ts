import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { rasterProcessingService } from "../services/rasterService.ts";
import { RasterSpatialMetadata } from "../../src/types/raster.ts";

const router = Router();

// Configure Multer for orthomosaic GeoTIFF uploads (supporting up to 250MB)
const uploadDir = path.resolve(process.cwd(), "data", "rasters");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `ortho_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 250 * 1024 * 1024, // 250MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".tif" || ext === ".tiff" || ext === ".cog") {
      cb(null, true);
    } else {
      cb(new Error("Only GeoTIFF formats (.tif, .tiff, .cog) are supported."));
    }
  },
});

// In-memory catalog of active ingested rasters
interface IngestedRasterRecord {
  metadata: RasterSpatialMetadata;
  filePath: string;
}

const rasterCatalog = new Map<string, IngestedRasterRecord>();

/**
 * POST /api/raster/upload
 * Handles multi-megabyte GeoTIFF uploads with optional EPSG override
 */
router.post(
  "/upload",
  (upload.single("raster") as unknown) as (
    req: Request,
    res: Response,
    next: (err?: unknown) => void
  ) => void,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No GeoTIFF file provided in 'raster' form field.",
        });
        return;
      }

      const epsgOverride = req.body.epsg ? parseInt(req.body.epsg, 10) : undefined;
      const filePath = req.file.path;
      const originalname = req.file.originalname;

      // Verify file exists and is readable
      if (!fs.existsSync(filePath)) {
        res.status(500).json({
          success: false,
          message: "Uploaded file not found after save",
        });
        return;
      }

      // Extract and validate spatial metadata
      const metadata = await rasterProcessingService.inspectGeoTiff(
        filePath,
        originalname,
        epsgOverride
      );

      // Verify source file is a valid GeoTIFF with spatial tags
      if (!metadata.hasSpatialTags) {
        res.status(400).json({
          success: false,
          message: "Uploaded GeoTIFF lacks required spatial metadata (tie points, pixel scale, or model transformation). Cannot generate tiles without georeferencing.",
          metadata,
        });
        return;
      }

      // Store in catalog
      rasterCatalog.set(metadata.rasterId, {
        metadata,
        filePath,
      });

      res.status(200).json({
        success: true,
        message: "Cloud-Optimized GeoTIFF raster ingested successfully",
        metadata,
      });
    } catch (err: unknown) {
      console.error("Raster upload processing error:", err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : "Failed to process GeoTIFF orthomosaic",
      });
    }
  }
);

/**
 * GET /api/tiles/:rasterId/:z/:x/:y.png
 * Serves dynamic or cached Web Mercator Slippy Map tiles
 * Returns 404 if raster not found or source file missing - no fake tiles
 */
router.get(
  "/tiles/:rasterId/:z/:x/:y.png",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rasterId } = req.params;
      const z = parseInt(req.params.z, 10);
      const x = parseInt(req.params.x, 10);
      const y = parseInt(req.params.y, 10);

      const record = rasterCatalog.get(rasterId);
      if (!record) {
        res.status(404).send("Raster ID not found");
        return;
      }

      // Verify source file exists
      if (!fs.existsSync(record.filePath)) {
        console.error(`Tile request for missing source file: ${record.filePath}`);
        res.status(404).send("Raster source file not found");
        return;
      }

      const tileBuffer = await rasterProcessingService.renderDynamicTile(
        record.metadata,
        record.filePath,
        z,
        x,
        y
      );

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.send(tileBuffer);
    } catch (err) {
      console.error("Tile render error:", err);
      res.status(500).send("Error rendering tile");
    }
  }
);

/**
 * GET /api/raster/list
 * Returns list of all available ingested rasters
 */
router.get("/list", (_req: Request, res: Response) => {
  const rasters = Array.from(rasterCatalog.values()).map((r) => r.metadata);
  res.json({
    success: true,
    rasters,
  });
});

/**
 * GET /api/raster/:rasterId/metadata
 */
router.get("/:rasterId/metadata", (req: Request, res: Response) => {
  const { rasterId } = req.params;
  const record = rasterCatalog.get(rasterId);
  if (!record) {
    res.status(404).json({ success: false, message: "Raster not found" });
    return;
  }
  res.json({ success: true, metadata: record.metadata });
});

export default router;
