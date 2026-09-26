/**
 * GeoTrace-AI Official Land Survey & CAD Exporters Express Router
 * Day 3: LandXML v1.2 & AutoCAD DXF server endpoints
 */

import { Router, Request, Response } from "express";
import { exportToLandXML } from "../../src/lib/exporters/landxmlExporter";
import { exportToDXF } from "../../src/lib/exporters/dxfExporter";
import { HIGH_PRECISION_PARCELS } from "../../src/data/cadastralDataset";
import { ParcelFeature } from "../../src/types/exportTypes";

const router = Router();

function getBenchmarkParcels(): ParcelFeature[] {
  return HIGH_PRECISION_PARCELS.map((p) => ({
    id: p.id,
    uprn: p.uprn,
    ownerName: p.ownerName,
    landType: p.landType,
    status: p.status,
    coordinates: p.coordinates,
    calculatedAreaSqMeters: p.historicalAreaSqM || 120,
    historicalAreaSqM: p.historicalAreaSqM || 120,
    perimeterMeters: 45,
    surveyNumber: p.surveyNumber,
    subDivision: p.subDivision,
    district: "Chennai",
    taluk: "Velachery",
    village: "Thiruvanmiyur",
  }));
}

// GET /api/export/landxml - Export current default survey as LandXML v1.2
router.get("/landxml", (req: Request, res: Response) => {
  try {
    const xml = exportToLandXML(getBenchmarkParcels(), {
      district: (req.query.district as string) || "Chennai",
      taluk: (req.query.taluk as string) || "Velachery",
      village: (req.query.village as string) || "Thiruvanmiyur",
      surveyNumber: (req.query.surveyNumber as string) || "142",
      surveyorName: "Senior Cadastral Revenue Surveyor",
      surveyorCredentials: "Licensed Cadastral Surveyor (TN-REV-SURV-2026)",
    });

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Cadastral_Survey_142_LandXML.xml"'
    );
    res.status(200).send(xml);
  } catch (error) {
    console.error("LandXML export error:", error);
    res.status(500).json({ error: "Failed to generate LandXML file" });
  }
});

// POST /api/export/landxml - Export dynamic parcel collection as LandXML v1.2
router.post("/landxml", (req: Request, res: Response) => {
  try {
    const { parcels, metadata } = req.body;
    const targetParcels =
      Array.isArray(parcels) && parcels.length > 0
        ? parcels
        : getBenchmarkParcels();

    const xml = exportToLandXML(targetParcels, metadata || {});
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Cadastral_Survey_Custom_LandXML.xml"'
    );
    res.status(200).send(xml);
  } catch (error) {
    console.error("Dynamic LandXML export error:", error);
    res.status(500).json({ error: "Failed to generate LandXML file" });
  }
});

// GET /api/export/dxf - Export current default survey as AutoCAD DXF
router.get("/dxf", (req: Request, res: Response) => {
  try {
    const dxf = exportToDXF(getBenchmarkParcels());
    res.setHeader("Content-Type", "application/dxf; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Cadastral_Survey_142_AutoCAD.dxf"'
    );
    res.status(200).send(dxf);
  } catch (error) {
    console.error("AutoCAD DXF export error:", error);
    res.status(500).json({ error: "Failed to generate AutoCAD DXF file" });
  }
});

// POST /api/export/dxf - Export dynamic parcel collection as AutoCAD DXF
router.post("/dxf", (req: Request, res: Response) => {
  try {
    const { parcels, options } = req.body;
    const targetParcels =
      Array.isArray(parcels) && parcels.length > 0
        ? parcels
        : getBenchmarkParcels();

    const dxf = exportToDXF(targetParcels, options || {});
    res.setHeader("Content-Type", "application/dxf; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Cadastral_Survey_Custom_AutoCAD.dxf"'
    );
    res.status(200).send(dxf);
  } catch (error) {
    console.error("Dynamic AutoCAD DXF export error:", error);
    res.status(500).json({ error: "Failed to generate AutoCAD DXF file" });
  }
});

export default router;
