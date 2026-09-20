import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
  FileCode,
  Download,
  Terminal,
  ShieldCheck,
  ChevronRight,
  Crosshair,
  Maximize2,
  Minimize2,
  X,
  FileText,
  Compass,
  Radio,
  Share2,
  Database,
  Cpu,
  CornerDownRight,
  ArrowRightLeft
} from "lucide-react";
import {
  Parcel,
  UAVTelemetry,
  DualStreamVerificationResult,
  DualStreamParcel,
  DualStreamPriorityReviewItem,
  HomographyMatrix,
  StreamAState,
  StreamBState,
} from "../types";

interface DualStreamCadastralCockpitProps {
  onClose?: () => void;
  parcels: Parcel[];
  telemetry: UAVTelemetry | null;
  selectedParcel: Parcel | null;
  onSelectParcel: (parcel: Parcel) => void;
}

export const DualStreamCadastralCockpit: React.FC<DualStreamCadastralCockpitProps> = ({
  onClose,
  parcels,
  telemetry,
  selectedParcel,
  onSelectParcel,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"DUAL_VIEW" | "CO_REGISTRATION" | "TOPOLOGY_GRAPH" | "GEMINI_AI" | "TRAINING_SPEC">("DUAL_VIEW");

  // Stream A (Scanned Blueprint) State
  const [streamA, setStreamA] = useState<StreamAState>({
    rawScanLoaded: true,
    otsuBinarized: true,
    skeletonized: true,
    gLinesExtracted: true,
    fLinesExtracted: true,
    ocrMasked: true,
    activeFilter: "VECTOR_OVERLAY",
  });

  // Stream B (Live UAV Feed) State
  const [streamB, setStreamB] = useState<StreamBState>({
    rtspLive: true,
    sam2Segmented: true,
    yoloSegEdges: true,
    physicalWallsExtracted: true,
    activeFilter: "SAM2_MASK",
  });

  // Hyperparameters for Priority Index P_i = α*d_Chamfer + β*|D_bp - D_dr| + γ*σ_epi^2
  const [alpha, setAlpha] = useState<number>(0.45);
  const [beta, setBeta] = useState<number>(0.35);
  const [gamma, setGamma] = useState<number>(0.20);
  const [maxGapMeters, setMaxGapMeters] = useState<number>(0.30);
  const [useTPSWarp, setUseTPSWarp] = useState<boolean>(true);

  // Verification & Computation State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<DualStreamVerificationResult | null>(null);
  const [selectedReviewItem, setSelectedReviewItem] = useState<DualStreamPriorityReviewItem | null>(null);
  const [pythonOutput, setPythonOutput] = useState<string | null>(null);
  const [isRunningPython, setIsRunningPython] = useState<boolean>(false);
  const [isCallingGemini, setIsCallingGemini] = useState<boolean>(false);
  const [systemPromptData, setSystemPromptData] = useState<any>(null);

  // Initial load: Fetch system prompt and run initial cross-verification
  useEffect(() => {
    fetchSystemPrompt();
    runCrossVerification();
  }, []);

  const fetchSystemPrompt = async () => {
    try {
      const res = await fetch("/api/dual-stream/system-prompt");
      const data = await res.json();
      setSystemPromptData(data);
    } catch (e) {
      console.error("Failed to fetch system prompt:", e);
    }
  };

  const runCrossVerification = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dual-stream/cross-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintParcels: parcels.slice(0, 4),
          alpha,
          beta,
          gamma,
        }),
      });
      const data: DualStreamVerificationResult = await res.json();
      setVerificationResult(data);
      if (data.connectivity_audit?.priority_review_queue?.length > 0) {
        setSelectedReviewItem(data.connectivity_audit.priority_review_queue[0]);
      }
    } catch (e) {
      console.error("Cross-verification error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteGeminiVlm = async () => {
    setIsCallingGemini(true);
    try {
      const res = await fetch("/api/dual-stream/gemini-inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintContext: {
            survey_number: selectedParcel?.surveyNumber || "142/2A",
            state: "Tamil Nadu",
            district: "Chennai",
            village: "Velachery",
            annotated_area_sqm: selectedParcel?.calculatedAreaSqMeters || 450.5,
          },
          droneTelemetry: telemetry,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setVerificationResult((prev) => ({
          ...(prev || ({} as any)),
          ...data.result,
          raw_gemini_response: data.raw_text || JSON.stringify(data.result, null, 2),
          generated_at: data.timestamp,
        }));
        setActiveTab("GEMINI_AI");
      }
    } catch (e) {
      console.error("Gemini VLM execution error:", e);
    } finally {
      setIsCallingGemini(false);
    }
  };

  const handleRunPythonScript = async () => {
    setIsRunningPython(true);
    try {
      const res = await fetch("/api/dual-stream/execute-python", { method: "POST" });
      const data = await res.json();
      setPythonOutput(data.stdout || data.details || "Python execution completed.");
    } catch (e: any) {
      setPythonOutput(`Execution error: ${e?.message || e}`);
    } finally {
      setIsRunningPython(false);
    }
  };

  const handleDownloadDataset = () => {
    window.open("/api/dual-stream/training-dataset", "_blank");
  };

  const homography: HomographyMatrix = verificationResult?.co_registration?.homography_matrix || [
    [0.009559, -0.004837, 80.208589],
    [0.001547, -0.000782, 12.983567],
    [0.000119, -0.000060, 1.0],
  ];

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/95 backdrop-blur-xl flex flex-col text-slate-100 font-sans overflow-hidden animate-in fade-in">
      {/* 1. Header Toolbar */}
      <div className="shrink-0 px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-400 p-0.5 shadow-lg shadow-sky-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sky-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-white tracking-wide">
                Dual-Stream Cadastral AI Cockpit
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                LIVE CO-REGISTRATION & PLANAR RECONSTRUCTION
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multi-Modal Alignment: Scanned Government Blueprint (FMB/TSLR) &times; Live UAV Video Stream
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("DUAL_VIEW")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "DUAL_VIEW"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Dual Stream View</span>
          </button>

          <button
            onClick={() => setActiveTab("CO_REGISTRATION")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "CO_REGISTRATION"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Homography &amp; TPS</span>
          </button>

          <button
            onClick={() => setActiveTab("TOPOLOGY_GRAPH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "TOPOLOGY_GRAPH"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Master Graph &amp; Discrepancies</span>
          </button>

          <button
            onClick={() => setActiveTab("GEMINI_AI")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "GEMINI_AI"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "text-amber-400/80 hover:text-amber-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini 2.0 VLM</span>
          </button>

          <button
            onClick={() => setActiveTab("TRAINING_SPEC")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "TRAINING_SPEC"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Dataset &amp; Python</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecuteGeminiVlm}
            disabled={isCallingGemini}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
            title="Execute Dual-Stream VLM Inference with Gemini 2.0 Flash"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isCallingGemini ? "Analyzing..." : "Run Gemini VLM"}</span>
          </button>

          <button
            onClick={runCrossVerification}
            disabled={isLoading}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
            title="Re-run mathematical Chamfer & Homography alignment"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Aligning..." : "Re-Verify"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Close Cockpit"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "DUAL_VIEW" && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-y-auto">
            {/* STREAM A: Scanned Government Blueprint Pipeline */}
            <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                    Stream A: Scanned Blueprint (FMB / TSLR)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(["RAW", "OTSU", "SKELETON", "VECTOR_OVERLAY"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setStreamA((prev) => ({ ...prev, activeFilter: mode }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                        streamA.activeFilter === mode
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stream A Visualization Canvas */}
              <div className="relative flex-1 min-h-[340px] bg-slate-950 flex items-center justify-center overflow-hidden p-4">
                <svg className="w-full h-full max-h-[380px]" viewBox="0 0 600 400">
                  {/* Paper Background / Watermark Texture */}
                  <rect
                    x="20"
                    y="20"
                    width="560"
                    height="360"
                    fill={streamA.activeFilter === "RAW" ? "#1e1e18" : "#0f172a"}
                    stroke="#334155"
                    strokeWidth="1.5"
                    rx="8"
                  />

                  {/* Survey Grid & Discoloration Simulation */}
                  {streamA.activeFilter === "RAW" && (
                    <g opacity="0.25">
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ca8a04" strokeWidth="0.5" />
                      </pattern>
                      <rect x="20" y="20" width="560" height="360" fill="url(#grid)" />
                      <text x="300" y="50" fill="#a1a1aa" fontSize="11" textAnchor="middle" fontFamily="monospace">
                        GOVERNMENT OF TAMIL NADU - SURVEY &amp; LAND RECORDS (FMB 142/2)
                      </text>
                    </g>
                  )}

                  {/* G-Line (Central Baseline) */}
                  <line
                    x1="80"
                    y1="200"
                    x2="520"
                    y2="200"
                    stroke={streamA.activeFilter === "SKELETON" ? "#ffffff" : "#f59e0b"}
                    strokeWidth={streamA.activeFilter === "SKELETON" ? "1" : "2"}
                    strokeDasharray={streamA.activeFilter === "RAW" ? "none" : "6,4"}
                  />
                  <text x="300" y="192" fill="#f59e0b" fontSize="10" textAnchor="middle" fontWeight="bold">
                    G-LINE BASELINE (Chainage 184.5m, Azimuth 92.4°)
                  </text>

                  {/* F-Line Offsets (Perpendicular Ladder Stations) */}
                  {[
                    { x: 160, yOffsetTop: -90, yOffsetBottom: 85, label: "Stn A (42m)" },
                    { x: 280, yOffsetTop: -95, yOffsetBottom: 90, label: "Stn B (95m)" },
                    { x: 420, yOffsetTop: -88, yOffsetBottom: 82, label: "Stn C (150m)" },
                  ].map((stn, idx) => (
                    <g key={idx}>
                      <line
                        x1={stn.x}
                        y1={200 + stn.yOffsetTop}
                        x2={stn.x}
                        y2={200 + stn.yOffsetBottom}
                        stroke="#0ea5e9"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                      <circle cx={stn.x} cy="200" r="3.5" fill="#38bdf8" />
                      <circle cx={stn.x} cy={200 + stn.yOffsetTop} r="4" fill="#f43f5e" />
                      <circle cx={stn.x} cy={200 + stn.yOffsetBottom} r="4" fill="#f43f5e" />
                      <text x={stn.x + 6} y="215" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                        {stn.label}
                      </text>
                    </g>
                  ))}

                  {/* Cadastral Blueprint Parcels */}
                  {/* Parcel 142/2A */}
                  <polygon
                    points="80,110 280,105 280,290 80,285"
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                  <text x="180" y="180" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">
                    S.No. 142/2A
                  </text>
                  <text x="180" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    Area: 450.5 m²
                  </text>

                  {/* Parcel 142/2B */}
                  <polygon
                    points="280,105 520,112 520,282 280,290"
                    fill="rgba(168, 85, 247, 0.12)"
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                  <text x="400" y="180" fill="#c084fc" fontSize="13" fontWeight="bold" textAnchor="middle">
                    S.No. 142/2B
                  </text>
                  <text x="400" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    Area: 448.0 m²
                  </text>

                  {/* Survey Corner Stones (Junctions) */}
                  {[
                    [80, 110], [280, 105], [520, 112],
                    [520, 282], [280, 290], [80, 285]
                  ].map(([cx, cy], i) => (
                    <g key={i}>
                      <rect x={cx - 4} y={cy - 4} width="8" height="8" fill="#eab308" stroke="#0f172a" strokeWidth="1" />
                      <text x={cx + 6} y={cy - 4} fill="#eab308" fontSize="8" fontFamily="monospace">
                        CS-{i + 1}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Bottom Stream A Info Overlay */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-300 font-mono">Otsu Threshold: 128 | Skeleton: 1-Pixel Clean</span>
                  </div>
                  <span className="text-amber-400 font-mono font-bold">2 G-Lines &bull; 6 Control Pegs</span>
                </div>
              </div>
            </div>

            {/* STREAM B: Live UAV Drone Terrain & SAM-2/YOLOv8 Edge Pipeline */}
            <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-emerald-300">
                    Stream B: Live UAV Drone Feed &amp; Terrain Edge Mask
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(["RGB", "SAM2_MASK", "YOLO_SEG", "EDGE_OVERLAY"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setStreamB((prev) => ({ ...prev, activeFilter: mode }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                        streamB.activeFilter === mode
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stream B Visualization Canvas */}
              <div className="relative flex-1 min-h-[340px] bg-slate-950 flex items-center justify-center overflow-hidden p-4">
                <svg className="w-full h-full max-h-[380px]" viewBox="0 0 600 400">
                  {/* Terrain Aerial Surface Background */}
                  <rect x="20" y="20" width="560" height="360" fill="#09131f" stroke="#1e293b" strokeWidth="1.5" rx="8" />

                  {/* Physical Road Curb */}
                  <polygon
                    points="20,330 580,330 580,380 20,380"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text x="300" y="358" fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="bold">
                    60 FT MUNICIPAL ROAD RIGHT-OF-WAY (ASPHALT CURB)
                  </text>

                  {/* SAM-2 / YOLO Detected Compound Wall Boundaries */}
                  {/* Physical Parcel 142/2A (With Encroachment Deviation Highlighted) */}
                  <polygon
                    points="80,110 295,108 295,295 80,285"
                    fill="rgba(16, 185, 129, 0.15)"
                    stroke="#10b981"
                    strokeWidth="2.5"
                  />

                  {/* Physical Parcel 142/2B */}
                  <polygon
                    points="295,108 520,112 520,282 295,295"
                    fill="rgba(14, 165, 233, 0.15)"
                    stroke="#0ea5e9"
                    strokeWidth="2.5"
                  />

                  {/* Built-up Physical Structures (Roof footprints) */}
                  <rect x="110" y="140" width="120" height="90" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" rx="3" />
                  <text x="170" y="190" fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">
                    G+2 RESIDENTIAL (240m²)
                  </text>

                  <rect x="330" y="145" width="130" height="85" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" rx="3" />
                  <text x="395" y="192" fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">
                    G+1 COMMERCIAL (220m²)
                  </text>

                  {/* Discrepancy Encroachment Polygon Area (Red Hatching) */}
                  <polygon
                    points="280,105 295,108 295,295 280,290"
                    fill="rgba(239, 68, 68, 0.45)"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                  />
                  <text x="305" y="210" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    &Delta;d = 1.45m SHIFT
                  </text>

                  {/* UAV Optical Crosshair HUD Overlay */}
                  <circle cx="300" cy="200" r="28" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                  <line x1="260" y1="200" x2="340" y2="200" stroke="#10b981" strokeWidth="1" opacity="0.7" />
                  <line x1="300" y1="160" x2="300" y2="240" stroke="#10b981" strokeWidth="1" opacity="0.7" />
                </svg>

                {/* Stream B Telemetry OSD */}
                <div className="absolute top-6 left-6 bg-slate-950/85 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-[10px] font-mono text-emerald-300 backdrop-blur-md">
                  <div>ALT: {telemetry?.altitude_agl ?? 50.0}m AGL | GSD: {telemetry?.gsd_cm_px ?? 1.8} cm/px</div>
                  <div>RTK: {telemetry?.rtk_status ?? "FIXED"} | HDG: {telemetry?.heading_deg ?? 45.0}°</div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-300 font-mono">SAM-2 Mask: Compound Wall &bull; Curb &bull; Hedge</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">14 Edges &bull; 2 Structures</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "CO_REGISTRATION" && (
          <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-y-auto">
            {/* Left: 3x3 Homography Matrix & TPS Warp Specs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Crosshair className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm text-white">
                  Co-Registration Transformation Matrix H &isin; &Ropf;<sup>3&times;3</sup>
                </h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Maps blueprint pixel coordinates <code className="text-sky-300 font-mono">[u_b, v_b, 1]ᵀ</code> to georeferenced spatial frame <code className="text-emerald-300 font-mono">[u_d, v_d, 1]ᵀ</code>.
              </p>

              {/* Matrix Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Homography Matrix (Normalized)</div>
                <div className="grid grid-cols-3 gap-2 text-center text-sky-300 font-bold">
                  {homography.map((row, rIdx) =>
                    row.map((val, cIdx) => (
                      <div key={`${rIdx}-${cIdx}`} className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        {typeof val === "number" ? val.toFixed(6) : val}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Mathematical Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Mean Alignment Error</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {verificationResult?.co_registration?.mean_alignment_error_meters ?? 0.142} m
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">&le; 0.30m Tolerance Pass</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Confidence Score</div>
                  <div className="text-lg font-bold text-sky-400 font-mono mt-0.5">
                    {Math.round((verificationResult?.co_registration?.confidence_score ?? 0.948) * 100)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">RANSAC Inliers: 100%</div>
                </div>
              </div>

              {/* Thin-Plate Spline Toggle */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Thin-Plate Spline (TPS) Warp</div>
                  <div className="text-[10px] text-slate-400">Non-rigid radial basis kernel U(r)=r²ln(r)</div>
                </div>
                <button
                  onClick={() => setUseTPSWarp((prev) => !prev)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    useTPSWarp
                      ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {useTPSWarp ? "ENABLED" : "AFFINE ONLY"}
                </button>
              </div>
            </div>

            {/* Center / Right: Tie-Point Control Peg Verification Table */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">
                    Ground Control Peg &amp; Landmark Keypoint Alignment
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">4 Reference Survey Stones Verified</span>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Peg ID</th>
                      <th className="p-2.5">Blueprint (x_b, y_b)</th>
                      <th className="p-2.5">Drone RTK (x_d, y_d)</th>
                      <th className="p-2.5">&Delta;d (Displacement)</th>
                      <th className="p-2.5">Confidence</th>
                      <th className="p-2.5 rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                    {[
                      { id: "CS-01", bp: "[100, 150]", dr: "[80.20880, 12.98380]", disp: 0.08, conf: 0.96, ok: true },
                      { id: "CS-02", bp: "[500, 140]", dr: "[80.20960, 12.98385]", disp: 0.12, conf: 0.92, ok: true },
                      { id: "CS-03", bp: "[510, 600]", dr: "[80.20965, 12.98450]", disp: 0.15, conf: 0.91, ok: true },
                      { id: "CS-04", bp: "[105, 590]", dr: "[80.20882, 12.98445]", disp: 0.10, conf: 0.94, ok: true },
                    ].map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/50 transition">
                        <td className="p-2.5 font-bold text-sky-400">{row.id}</td>
                        <td className="p-2.5 text-slate-400">{row.bp}</td>
                        <td className="p-2.5 text-emerald-300">{row.dr}</td>
                        <td className="p-2.5 font-bold text-amber-300">{row.disp} m</td>
                        <td className="p-2.5 text-slate-300">{Math.round(row.conf * 100)}%</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            CO-REGISTERED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mathematical Formulation Alert */}
              <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono">
                <span className="text-sky-400 font-bold">Chamfer Boundary Metric Formula:</span>
                <div className="text-slate-400 mt-1">
                  d_Chamfer(S_B, S_D) = (1/|S_B|) &sum; min ||x - y||₂ + (1/|S_D|) &sum; min ||x - y||₂
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "TOPOLOGY_GRAPH" && (
          <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-y-auto">
            {/* Left: Master Topological Graph G=(V,E) Stats & Enforcements */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Share2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-white">
                  Master Planar Graph G = (V, E)
                </h3>
              </div>

              {/* Shared Edge Enforcement Card */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Shared-Edge Planar Rule</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                    &part;P_a &cap; &part;P_b = e_ij
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Adjacent parcels share mathematically single-instance edges. Gaps, slivers, and double-line overlap eliminated.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-mono">Nodes Evaluated</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {verificationResult?.connectivity_audit?.total_nodes_evaluated ?? 24}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-mono">Shared Edges</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {verificationResult?.connectivity_audit?.shared_edges_verified ?? 18}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-mono">Topological Overlaps</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {verificationResult?.connectivity_audit?.topological_overlaps_detected ?? 0}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-mono">Topological Gaps</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {verificationResult?.connectivity_audit?.topological_gaps_detected ?? 0}
                  </div>
                </div>
              </div>

              {/* Hyperparameter Tuners */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5 text-xs">
                <div className="text-[11px] font-bold text-slate-300 font-mono uppercase">
                  Discrepancy Index Parameters (P_i)
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span>Chamfer Weight (&alpha;): {alpha}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={alpha}
                    onChange={(e) => setAlpha(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg accent-sky-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span>Dimension Mismatch (&beta;): {beta}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={beta}
                    onChange={(e) => setBeta(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span>Epistemic Variance (&gamma;): {gamma}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={gamma}
                    onChange={(e) => setGamma(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Center / Right: Priority Discrepancy Review Queue (P_i) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-sm text-white">
                    Priority Discrepancy Review Queue (P_i Score Ranked)
                  </h3>
                </div>
                <span className="text-xs font-mono text-amber-300 font-bold">
                  {verificationResult?.connectivity_audit?.priority_review_queue?.length || 1} Flagged for Review
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5">
                {(
                  verificationResult?.connectivity_audit?.priority_review_queue || [
                    {
                      node_id: "N04",
                      issue_type: "PHYSICAL_INCROACHMENT_OR_DISPLACEMENT",
                      blueprint_offset_m: 12.4,
                      drone_measured_m: 10.8,
                      displacement_meters: 1.6,
                      priority_score: 0.87,
                    },
                  ]
                ).map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedReviewItem(item)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      selectedReviewItem?.node_id === item.node_id
                        ? "bg-slate-950 border-amber-500/80 shadow-lg shadow-amber-500/10"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="font-bold text-sm text-white font-mono">{item.node_id}</span>
                        <span className="text-xs font-mono text-slate-400">({item.issue_type})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          P_i = {item.priority_score}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2.5 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-slate-500">Blueprint Dim:</span>{" "}
                        <span className="font-bold text-sky-300">{item.blueprint_offset_m} m</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Drone Dim:</span>{" "}
                        <span className="font-bold text-emerald-300">{item.drone_measured_m} m</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Displacement:</span>{" "}
                        <span className="font-bold text-rose-400">
                          {item.displacement_meters ?? Math.round(Math.abs(item.blueprint_offset_m - item.drone_measured_m) * 10) / 10} m
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "GEMINI_AI" && (
          <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto">
            {/* System Prompt & Pipeline Instructions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-sm text-white">
                    Production Dual-Stream System Prompt
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                  Gemini 2.0 Flash Vision
                </span>
              </div>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {systemPromptData?.system_prompt || "Loading production system prompt..."}
              </div>
            </div>

            {/* Live Model Output JSON Schema */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">
                    Validated Model Topology JSON Schema
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40">
                  STRICT SCHEMA 200 OK
                </span>
              </div>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(verificationResult || systemPromptData?.schema_spec, null, 2)}
              </div>
            </div>
          </div>
        )}

        {activeTab === "TRAINING_SPEC" && (
          <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto">
            {/* Multi-Task Training Strategy */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-sm text-white">
                    Multi-Task Training &amp; Dataset Annotation Strategy
                  </h3>
                </div>
                <button
                  onClick={handleDownloadDataset}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Spec</span>
                </button>
              </div>

              {/* Tasks Breakdown */}
              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between font-bold text-amber-300 mb-1">
                    <span>Task A: Blueprint Vectorization Engine</span>
                    <span className="font-mono text-[10px]">U-Net / Frame Field</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Loss: Dice Loss + Binary Cross-Entropy (BCE). Generates single-pixel skeletons and junction keypoints.
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between font-bold text-emerald-300 mb-1">
                    <span>Task B: Drone Terrain Physical Edge Extractor</span>
                    <span className="font-mono text-[10px]">YOLOv8x-seg / SAM-2</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Extracts compound walls, fences, hedges, field bunds, and curbs from aerial orthomosaics.
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between font-bold text-purple-300 mb-1">
                    <span>Task C: Cross-Modal Graph Attention Network (GAT)</span>
                    <span className="font-mono text-[10px]">Graph Neural Network</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Ingests G_blueprint and G_drone, closes topological gaps (&lt;0.30m), enforces shared-edge zero-overlap.
                  </p>
                </div>
              </div>

              {/* Annotation Spec Table */}
              <div className="mt-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono">
                <div className="text-slate-400 font-bold uppercase mb-1.5">Annotation Specifications:</div>
                <div className="text-slate-300">• FMB Blueprint: ["g_line", "f_line", "survey_stone", "text_box", "boundary_corner"]</div>
                <div className="text-slate-300 mt-1">• UAV Drone Feed: ["compound_wall", "fence", "hedge", "field_bund", "curb", "drainage_edge"]</div>
              </div>
            </div>

            {/* Standalone Python Execution Runner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">
                    Python Execution Pipeline (Phase IV)
                  </h3>
                </div>
                <button
                  onClick={handleRunPythonScript}
                  disabled={isRunningPython}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{isRunningPython ? "Executing..." : "Execute Python Script"}</span>
                </button>
              </div>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {pythonOutput ||
                  `[INFO] Press "Execute Python Script" to run cadastral_dual_stream_aligner.py directly on the server.`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
