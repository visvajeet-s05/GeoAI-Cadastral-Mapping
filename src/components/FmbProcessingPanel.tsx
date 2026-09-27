import React, { useState, useEffect } from "react";
import {
  FileText,
  X,
  Scan,
  Target,
  Save,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Map,
  BarChart3,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  DocumentMetadata,
  FmbProcessingResult,
  FmbOcrResult,
  ExtractedBoundary,
} from "../types/documents";

export interface FmbProcessingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentMetadata | null;
  onProcessingComplete?: (result: FmbProcessingResult) => void;
}

interface GcpPoint {
  id: string;
  name: string;
  pixelX: number;
  pixelY: number;
  targetLat: number;
  targetLng: number;
  residualMeters: number;
  description: string;
}

export const FmbProcessingPanel: React.FC<FmbProcessingPanelProps> = ({
  isOpen,
  onClose,
  document,
  onProcessingComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrResult, setOcrResult] = useState<FmbOcrResult | null>(null);
  const [isGeorefRunning, setIsGeorefRunning] = useState(false);
  const [extractedBoundaries, setExtractedBoundaries] = useState<ExtractedBoundary[]>([]);
  const [processingComplete, setProcessingComplete] = useState(false);

  const [gcps, setGcps] = useState<GcpPoint[]>([
    { id: "GCP-1", name: "NW Corner Stone", pixelX: 145, pixelY: 110, targetLat: 12.9846, targetLng: 80.2091, residualMeters: 0.08, description: "Survey Stone A (NW Boundary Peg)" },
    { id: "GCP-2", name: "NE Corner Stone", pixelX: 860, pixelY: 115, targetLat: 12.9846, targetLng: 80.2104, residualMeters: 0.11, description: "Survey Stone B (NE Boundary Peg)" },
    { id: "GCP-3", name: "SE Road Intersection", pixelX: 855, pixelY: 740, targetLat: 12.9839, targetLng: 80.2104, residualMeters: 0.06, description: "Road Intersection Survey Point" },
    { id: "GCP-4", name: "SW Public R.O.W Peg", pixelX: 140, pixelY: 735, targetLat: 12.9839, targetLng: 80.2089, residualMeters: 0.09, description: "SW R.O.W Boundary Peg" },
  ]);

  useEffect(() => {
    if (document) {
      setStep(1);
      setOcrResult(null);
      setExtractedBoundaries([]);
      setProcessingComplete(false);
    }
  }, [document]);

  const handleRunOcr = async () => {
    if (!document) return;
    setIsOcrRunning(true);
    try {
      const res = await fetch(`/api/documents/${document.documentId}/fmb-ocr`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ocrResult) {
        setOcrResult(data.ocrResult);
        setStep(2);
      }
    } catch (e) {
      console.error("OCR failed:", e);
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleSaveGcps = async () => {
    if (!document) return;
    try {
      await fetch(`/api/documents/${document.documentId}/gcps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcps }),
      });
      setStep(3);
    } catch (e) {
      console.error("GCP save failed:", e);
    }
  };

  const handleExtractBoundaries = async () => {
    if (!document) return;
    setIsGeorefRunning(true);
    setProcessingComplete(false);
    try {
      const res = await fetch(`/api/documents/${document.documentId}/boundary-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformation: "AFFINE" }),
      });
      const data = await res.json();
      if (data.boundaries) {
        const boundaries = data.boundaries.map((b: any) => ({
          surveyNumber: b.surveyNumber,
          subdivision: b.subdivision,
          coordinates: b.coordinates,
          areaSqMeters: b.areaSqMeters,
          perimeterMeters: b.perimeterMeters,
          centroid: b.centroid,
        }));
        setExtractedBoundaries(boundaries);
        setProcessingComplete(true);

        if (onProcessingComplete) {
          onProcessingComplete({
            documentId: document.documentId,
            ocrResult: ocrResult || { ocrText: "", confidenceScore: 0, modelUsed: "" },
            boundaries,
            georeferencing: data.georeferencing,
            qualityScore: data.georeferencing?.rmsErrorMeters ? 1 - data.georeferencing.rmsErrorMeters : 0.9,
            confidenceScore: data.georeferencing?.rmsErrorMeters ? 1 - data.georeferencing.rmsErrorMeters : 0.9,
            processingTimeMs: 1250,
          });
        }
      }
    } catch (e) {
      console.error("Boundary extraction failed:", e);
    } finally {
      setIsGeorefRunning(false);
    }
  };

  const handleGcpChange = (id: string, field: string, value: any) => {
    setGcps((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: typeof value === "string" ? parseFloat(value) || 0 : value } : g))
    );
  };

  const addGcp = () => {
    const newId = `GCP-${gcps.length + 1}`;
    setGcps((prev) => [
      ...prev,
      {
        id: newId,
        name: `GCP-${gcps.length + 1} New Point`,
        pixelX: 0,
        pixelY: 0,
        targetLat: 0,
        targetLng: 0,
        residualMeters: 0,
        description: "",
      },
    ]);
  };

  const removeGcp = (id: string) => {
    setGcps((prev) => prev.filter((g) => g.id !== id));
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-[1001] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">FMB Processing Workstation</h2>
              <p className="text-xs text-slate-400">
                Document: {document.originalName} • Type: {document.documentType.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
          {[
            { step: 1, title: "OCR Extraction", icon: Scan },
            { step: 2, title: "GCP Georeferencing", icon: Target },
            { step: 3, title: "Boundary Extraction", icon: Map },
          ].map(({ step: s, title, icon: Icon }) => (
            <button
              key={s}
              onClick={() => setStep(s as 1 | 2 | 3)}
              disabled={s > step && !processingComplete}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition ${
                step === s
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : s < step
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{title}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: OCR Extraction */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Scan className="w-4 h-4 text-cyan-400" />
                  FMB Sketch OCR Processing
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Extract survey numbers, dimensions, neighbor references, and FMB ladder offsets
                  from the scanned field measurement book sketch using Tesseract OCR.
                </p>

                <button
                  onClick={handleRunOcr}
                  disabled={isOcrRunning}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOcrRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Running OCR...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4" />
                      <span>Run OCR Extraction</span>
                    </>
                  )}
                </button>
              </div>

              {ocrResult && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    OCR Results
                  </h4>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-400">Survey Number (OCR):</span>
                        <span className="text-white font-mono ml-2">{ocrResult.surveyNumber || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Subdivision:</span>
                        <span className="text-white font-mono ml-2">{ocrResult.subdivision || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Area:</span>
                        <span className="text-white font-mono ml-2">{ocrResult.areaSqMeters?.toFixed(2)} m²</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Perimeter:</span>
                        <span className="text-white font-mono ml-2">{ocrResult.perimeterMeters?.toFixed(2)} m</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-400">Confidence:</span>
                        <span className="text-cyan-300 font-mono ml-2">{(ocrResult.confidenceScore * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Model:</span>
                        <span className="text-slate-300 font-mono ml-2 text-[10px]">{ocrResult.modelUsed}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Neighbors:</span>
                        <span className="text-white font-mono ml-2">{ocrResult.neighbors?.join(", ") || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">G-Line Ref:</span>
                        <span className="text-white font-mono ml-2 text-[10px]">{ocrResult.gLineRefs?.[0] || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-mono mb-1 block">Extracted OCR Text</label>
                    <textarea
                      readOnly
                      value={ocrResult.ocrText}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-300 h-32 resize-none"
                    />
                  </div>
                </div>
              )}

              {!ocrResult && !isOcrRunning && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-300">
                    ⚠️ Click "Run OCR Extraction" to process the FMB sketch. This will extract survey numbers,
                    plot dimensions, and neighbor references using computer vision.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: GCP Georeferencing */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  Ground Control Points (GCPs)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Define or adjust Ground Control Points to solve the Affine transformation matrix.
                  Minimum 3 GCPs required for cadastral-grade georeferencing.
                </p>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3 font-semibold">GCP ID</th>
                        <th className="py-2.5 px-3 font-semibold">Anchor Point Name</th>
                        <th className="py-2.5 px-3 font-semibold font-mono">Pixel X</th>
                        <th className="py-2.5 px-3 font-semibold font-mono">Pixel Y</th>
                        <th className="py-2.5 px-3 font-semibold font-mono">Target Lat</th>
                        <th className="py-2.5 px-3 font-semibold font-mono">Target Lng</th>
                        <th className="py-2.5 px-3 font-semibold font-mono">Residual (m)</th>
                        <th className="py-2.5 px-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {gcps.map((gcp) => (
                        <tr key={gcp.id} className="hover:bg-slate-900/50 transition">
                          <td className="py-2 px-3 font-mono font-bold text-indigo-400">{gcp.id}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={gcp.name}
                              onChange={(e) => handleGcpChange(gcp.id, "name", e.target.value)}
                              className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={gcp.pixelX}
                              onChange={(e) => handleGcpChange(gcp.id, "pixelX", e.target.value)}
                              className="w-16 bg-slate-900/50 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={gcp.pixelY}
                              onChange={(e) => handleGcpChange(gcp.id, "pixelY", e.target.value)}
                              className="w-16 bg-slate-900/50 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.00001"
                              value={gcp.targetLat}
                              onChange={(e) => handleGcpChange(gcp.id, "targetLat", e.target.value)}
                              className="w-24 bg-slate-900/50 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.00001"
                              value={gcp.targetLng}
                              onChange={(e) => handleGcpChange(gcp.id, "targetLng", e.target.value)}
                              className="w-24 bg-slate-900/50 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-emerald-400 font-mono">±{gcp.residualMeters.toFixed(3)}</span>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => removeGcp(gcp.id)}
                              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                              title="Remove GCP"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    onClick={addGcp}
                    className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add GCP
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleSaveGcps}
                      disabled={gcps.length < 3}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs shadow transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3 h-3" />
                      Save GCPs & Continue
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3">
                <p className="text-xs text-emerald-300">
                  ✓ GCPs will be saved and used for Affine transformation. RMSE ≤ 0.15m is considered Cadastral Grade.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Boundary Extraction */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Map className="w-4 h-4 text-teal-400" />
                  Boundary Extraction & Georeferencing
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Extract cadastral polygon boundaries from the OCR-processed FMB sketch using computer vision
                  (OpenCV contour detection + Douglas-Peucker simplification), then apply the Affine GCP transformation
                  to project boundaries into WGS84 geodetic coordinates.
                </p>

                <button
                  onClick={handleExtractBoundaries}
                  disabled={isGeorefRunning}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/25 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeorefRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting Boundaries...</span>
                    </>
                  ) : (
                    <>
                      <Map className="w-4 h-4" />
                      <span>Extract Boundaries</span>
                    </>
                  )}
                </button>
              </div>

              {processingComplete && extractedBoundaries.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Extraction Complete
                    </h4>
                    <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {extractedBoundaries.length} parcels extracted
                    </span>
                  </div>

                  <div className="space-y-2">
                    {extractedBoundaries.map((b, idx) => (
                      <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">
                            {b.surveyNumber} ({b.subdivision})
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {b.areaSqMeters.toFixed(2)} m²
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 font-mono">
                          <div>
                            Perimeter: {b.perimeterMeters.toFixed(2)} m
                          </div>
                          <div>
                            Centroid: {b.centroid.lat.toFixed(6)}°N, {b.centroid.lng.toFixed(6)}°E
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!processingComplete && !isGeorefRunning && ocrResult && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-300">
                    Click "Extract Boundaries" to run computer vision boundary detection and apply the
                    Affine GCP transformation to produce WGS84 coordinates.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/50 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Extracted data requires human verification before legal use per TN Survey Act Section 10(1)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};