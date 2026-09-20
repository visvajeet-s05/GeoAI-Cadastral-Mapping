import React, { useState } from "react";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Crosshair,
  Sliders,
  Maximize2,
  X,
  Compass,
  Calendar,
  MapPin,
  RefreshCw,
  Eye,
  Check,
  Sparkles,
} from "lucide-react";
import { GroundControlPointRecord, HistoricalDocument } from "../types";

interface HistoricalBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentProcessed?: (doc: HistoricalDocument) => void;
}

export const HistoricalBlueprintModal: React.FC<HistoricalBlueprintModalProps> = ({
  isOpen,
  onClose,
  onDocumentProcessed,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Document Identification Metadata
  const [docType, setDocType] = useState<HistoricalDocument["documentType"]>("FMB_SKETCH");
  const [docTitle, setDocTitle] = useState("Velachery Town Field Measurement Book (FMB Sheet S.No. 142)");
  const [docSource, setDocSource] = useState("Tamil Nadu Survey & Land Records (eservices.tn.gov.in)");
  const [docYear, setDocYear] = useState(1967);
  const [state] = useState("Tamil Nadu");
  const [district, setDistrict] = useState("Chennai");
  const [taluk, setTaluk] = useState("Velachery");
  const [village, setVillage] = useState("Velachery Town");
  const [surveyNumber, setSurveyNumber] = useState("142");
  const [subDivision, setSubDivision] = useState("1A, 1B, 2A, 2B, 3A, 3B");
  const [scale, setScale] = useState("1:1000 Metric Cadastral");
  const [orientation, setOrientation] = useState("True North 0.0°");

  // Step 2: Image Cleanup & Preprocessing
  const [noiseRemoval, setNoiseRemoval] = useState(true);
  const [rotationCorrection, setRotationCorrection] = useState(0.4);
  const [contrastEnhancement, setContrastEnhancement] = useState(true);
  const [lineEnhancement, setLineEnhancement] = useState(true);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Step 3: Ground Control Points (GCPs) & Georeferencing
  const [gcps, setGcps] = useState<GroundControlPointRecord[]>([
    {
      id: "GCP-1",
      name: "Survey Stone A (NW Boundary Peg)",
      pixelX: 145,
      pixelY: 110,
      targetLat: 12.9846,
      targetLng: 80.2191,
      residualMeters: 0.08,
    },
    {
      id: "GCP-2",
      name: "Survey Stone B (NE Boundary Peg)",
      pixelX: 860,
      pixelY: 115,
      targetLat: 12.9846,
      targetLng: 80.2204,
      residualMeters: 0.11,
    },
    {
      id: "GCP-3",
      name: "Road Intersection Survey Point",
      pixelX: 855,
      pixelY: 740,
      targetLat: 12.9839,
      targetLng: 80.2204,
      residualMeters: 0.06,
    },
    {
      id: "GCP-4",
      name: "SW Public R.O.W Boundary Peg",
      pixelX: 140,
      pixelY: 735,
      targetLat: 12.9839,
      targetLng: 80.2189,
      residualMeters: 0.09,
    },
  ]);

  const [isGeoreferencing, setIsGeoreferencing] = useState(false);
  const [georefResult, setGeorefResult] = useState<{
    transformation: "AFFINE";
    rmsErrorM: number;
    status: "ACCEPTABLE" | "REVIEW_REQUIRED";
    qualityLabel: string;
  }>({
    transformation: "AFFINE",
    rmsErrorM: 0.085,
    status: "ACCEPTABLE",
    qualityLabel: "Cadastral Grade (<0.15m RMSE)",
  });

  // Step 4: Extraction & Digitization
  const [extractedParcelsCount, setExtractedParcelsCount] = useState(6);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionComplete, setExtractionComplete] = useState(false);

  if (!isOpen) return null;

  const handleSimulateCleanup = () => {
    setIsProcessingImage(true);
    setTimeout(() => {
      setIsProcessingImage(false);
      setCurrentStep(3);
    }, 600);
  };

  const handleRunGeoreferencing = () => {
    setIsGeoreferencing(true);
    setTimeout(() => {
      const rms = 0.085;
      setGeorefResult({
        transformation: "AFFINE",
        rmsErrorM: rms,
        status: rms <= 0.15 ? "ACCEPTABLE" : "REVIEW_REQUIRED",
        qualityLabel: "Cadastral Grade (<0.15m RMSE)",
      });
      setIsGeoreferencing(false);
      setCurrentStep(4);
    }, 700);
  };

  const handleFinalizeExtraction = () => {
    setIsExtracting(true);
    setTimeout(() => {
      setIsExtracting(false);
      setExtractionComplete(true);

      const doc: HistoricalDocument = {
        id: `DOC-TN-${surveyNumber}-${docYear}`,
        documentType: docType,
        title: docTitle,
        source: docSource,
        year: docYear,
        state,
        district,
        taluk,
        village,
        surveyNumber,
        subDivision,
        scale,
        orientation,
        georeferencing: {
          controlPoints: gcps,
          transformation: "AFFINE",
          rmsErrorM: georefResult.rmsErrorM,
          status: georefResult.status,
        },
        parcelsExtracted: extractedParcelsCount,
        status: "APPROVED",
      };

      if (onDocumentProcessed) {
        onDocumentProcessed(doc);
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg border border-sky-400/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Historical Land Document & Blueprint Processor
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                  Tamil Nadu Cadastre
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Georeference FMB sketches, TSLR plans & layout blueprints using Affine Ground Control Points
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs">
          {[
            { step: 1, title: "1. Document Metadata" },
            { step: 2, title: "2. Image Cleanup" },
            { step: 3, title: "3. GCP Georeferencing" },
            { step: 4, title: "4. Parcel Extraction" },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setCurrentStep(item.step as any)}
              className={`flex items-center gap-1.5 font-medium transition ${
                currentStep === item.step
                  ? "text-sky-400 font-bold"
                  : currentStep > item.step
                  ? "text-emerald-400"
                  : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === item.step
                    ? "bg-sky-500 text-slate-950"
                    : currentStep > item.step
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentStep > item.step ? "✓" : item.step}
              </span>
              <span>{item.title}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {/* STEP 1: DOCUMENT METADATA */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl p-3.5 text-xs text-sky-200">
                <span className="font-semibold text-white">Official Cadastral Document Intake:</span> Identify
                the historical document type, record year, and administrative jurisdiction under the Tamil Nadu
                Land Administration & CMDA/DTCP framework.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="FMB_SKETCH">FMB (Field Measurement Book) Sketch</option>
                    <option value="TSLR_MAP">TSLR (Town Survey Land Register) Map</option>
                    <option value="VILLAGE_CADASTRAL">Village Cadastral Map</option>
                    <option value="LAYOUT_PLAN">CMDA Approved Layout Plan</option>
                    <option value="PLOT_BLUEPRINT">DTCP Approved Blueprint (1974–2026)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Survey Record Year
                  </label>
                  <input
                    type="number"
                    value={docYear}
                    onChange={(e) => setDocYear(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Document Title / Archive Citation
                  </label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Issuing Authority / Portal Source
                  </label>
                  <input
                    type="text"
                    value={docSource}
                    onChange={(e) => setDocSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cartographic Scale
                  </label>
                  <input
                    type="text"
                    value={scale}
                    onChange={(e) => setScale(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  />
                </div>

                {/* Tamil Nadu Location Hierarchy */}
                <div className="md:col-span-2 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    <span>Tamil Nadu Administrative Hierarchy</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">District</span>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Taluk</span>
                      <input
                        type="text"
                        value={taluk}
                        onChange={(e) => setTaluk(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Village</span>
                      <input
                        type="text"
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Survey No.</span>
                      <input
                        type="text"
                        value={surveyNumber}
                        onChange={(e) => setSurveyNumber(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs shadow-md transition flex items-center gap-1.5"
                >
                  <span>Proceed to Image Cleanup</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: IMAGE CLEANUP & PREPROCESSING */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-5 items-center">
                {/* Scanned Map Blueprint Preview Canvas */}
                <div className="w-full md:w-1/2 aspect-[4/3] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden relative flex items-center justify-center p-2">
                  <svg className="w-full h-full text-sky-400/80" viewBox="0 0 400 300">
                    <rect width="400" height="300" fill="#020617" />
                    {/* Grid Lines */}
                    <path
                      d="M 50 0 V 300 M 150 0 V 300 M 250 0 V 300 M 350 0 V 300"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    <path
                      d="M 0 50 H 400 M 0 150 H 400 M 0 250 H 400"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    {/* FMB G-Line Axis */}
                    <line
                      x1="60"
                      y1="220"
                      x2="340"
                      y2="80"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                    <text x="70" y="240" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                      FMB Baseline G-Line (265.4m)
                    </text>
                    {/* Cadastral Lot Contours */}
                    <polygon
                      points="80,90 180,95 175,185 75,180"
                      fill="#0284c7"
                      fillOpacity="0.25"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                    <polygon
                      points="190,95 290,100 285,190 185,185"
                      fill="#0284c7"
                      fillOpacity="0.25"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                    <polygon
                      points="75,195 285,205 280,245 70,235"
                      fill="#f59e0b"
                      fillOpacity="0.25"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                    />
                    <text x="110" y="140" fill="#f8fafc" fontSize="11" fontWeight="bold">
                      Plot 1 (142/1A)
                    </text>
                    <text x="220" y="145" fill="#f8fafc" fontSize="11" fontWeight="bold">
                      Plot 2 (142/1B)
                    </text>
                    <text x="130" y="225" fill="#fef08a" fontSize="10" fontWeight="bold">
                      Public Road Reserve (12m)
                    </text>
                  </svg>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-slate-300 font-mono">
                    Scanned DPI: 300 • Contrast: +40%
                  </div>
                </div>

                {/* Preprocessing Toggles */}
                <div className="w-full md:w-1/2 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Blueprint Preprocessing Pipeline
                  </h3>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
                      <span className="font-medium text-slate-200">Noise & Salt-and-Pepper Filter</span>
                      <input
                        type="checkbox"
                        checked={noiseRemoval}
                        onChange={(e) => setNoiseRemoval(e.target.checked)}
                        className="rounded border-slate-700 text-sky-600 focus:ring-sky-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
                      <span className="font-medium text-slate-200">Adaptive Histogram Contrast Boost</span>
                      <input
                        type="checkbox"
                        checked={contrastEnhancement}
                        onChange={(e) => setContrastEnhancement(e.target.checked)}
                        className="rounded border-slate-700 text-sky-600 focus:ring-sky-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
                      <span className="font-medium text-slate-200">Morphological Cadastral Line Thinner</span>
                      <input
                        type="checkbox"
                        checked={lineEnhancement}
                        onChange={(e) => setLineEnhancement(e.target.checked)}
                        className="rounded border-slate-700 text-sky-600 focus:ring-sky-500"
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Deskew / Rotation Correction:</span>
                      <span className="font-mono text-sky-400">{rotationCorrection}°</span>
                    </div>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={rotationCorrection}
                      onChange={(e) => setRotationCorrection(Number(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSimulateCleanup}
                  disabled={isProcessingImage}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs shadow-md transition flex items-center gap-1.5"
                >
                  {isProcessingImage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing Raster...</span>
                    </>
                  ) : (
                    <>
                      <span>Apply & Georeference</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: GROUND CONTROL POINTS (GCP) & GEOREFERENCING */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Affine 2D Polynomial Transformation</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      {georefResult.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    RMSE: {georefResult.rmsErrorM}m • {georefResult.qualityLabel} • 4 Ground Control Points
                  </div>
                </div>

                <button
                  onClick={handleRunGeoreferencing}
                  disabled={isGeoreferencing}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs shadow transition flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeoreferencing ? "animate-spin" : ""}`} />
                  <span>Re-solve Affine</span>
                </button>
              </div>

              {/* GCP Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-semibold">GCP ID</th>
                      <th className="py-2.5 px-3 font-semibold">Anchor Description</th>
                      <th className="py-2.5 px-3 font-semibold font-mono">Pixel (X, Y)</th>
                      <th className="py-2.5 px-3 font-semibold font-mono">Target Coord (WGS84)</th>
                      <th className="py-2.5 px-3 font-semibold font-mono">Residual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {gcps.map((gcp) => (
                      <tr key={gcp.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-2 px-3 font-mono font-bold text-sky-400">{gcp.id}</td>
                        <td className="py-2 px-3">{gcp.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          [{gcp.pixelX}, {gcp.pixelY}]
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300">
                          {gcp.targetLat.toFixed(4)}° N, {gcp.targetLng.toFixed(4)}° E
                        </td>
                        <td className="py-2 px-3 font-mono text-emerald-400 font-semibold">
                          ±{gcp.residualMeters}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs shadow-md transition flex items-center gap-1.5"
                >
                  <span>Proceed to Parcel Extraction</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PARCEL BOUNDARY EXTRACTION */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Vector Cadastral Extracted & Georeferenced
                  </h4>
                  <p className="text-[11px] text-emerald-200/90 mt-0.5">
                    {extractedParcelsCount} Cadastral parcels successfully vectorized from 1967 FMB Sketch
                    into EPSG:4326 GIS vectors with sub-decimeter geodetic closure.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Survey Boundary</span>
                  <div className="font-bold text-white mt-1">S.No. 142 Velachery</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Affine Precision</span>
                  <div className="font-bold text-emerald-400 mt-1 font-mono">0.085m RMSE</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Sub-Divisions</span>
                  <div className="font-bold text-sky-400 mt-1 font-mono">6 Plots / OSR Buffer</div>
                </div>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                >
                  ← Back
                </button>
                <button
                  onClick={handleFinalizeExtraction}
                  disabled={isExtracting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-lg transition flex items-center gap-1.5"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Committing to Cadastral Registry...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Lock & Render on Map Layers</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
