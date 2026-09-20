import React, { useState, useEffect, useRef } from "react";
import {
  Plane,
  Crosshair,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Camera,
  Cpu,
  ShieldCheck,
  Eye,
  Info,
  Radio,
  Sliders,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { UAVTelemetry, Parcel } from "../types";

export interface AIDetectionItem {
  id: string;
  type: "BUILDING" | "OPEN_AREA" | "ROAD" | "BOUNDARY_CANDIDATE" | "UNKNOWN";
  label: string;
  confidence: number;
  status: "AUTOMATIC" | "CONFIRMED" | "EDITED" | "DISPUTED";
  polygon: [number, number][];
  imagePolygon?: [number, number][]; // [x, y] in 800x600 coordinate space
  areaSqM: number;
  heightMeters?: number;
  linkedParcelId?: string;
  multiParcelCrossing?: boolean;
  intersectingParcelIds?: string[];
  disclaimer?: string;
  surveyorNotes?: string;
  positionUncertaintyMeters?: number;
  projectionMode?: "FLAT_GROUND" | "DEM";
  trackId?: string;
}

interface LiveDroneSplitViewProps {
  telemetry: UAVTelemetry | null;
  selectedParcel: Parcel | null;
  onSelectParcel: (parcel: Parcel) => void;
  parcels: Parcel[];
  selectedDetection: AIDetectionItem | null;
  onSelectDetection: (detection: AIDetectionItem | null) => void;
  isSplitScreen: boolean;
  onToggleSplitScreen: () => void;
  onClose?: () => void;
}

export const LiveDroneSplitView: React.FC<LiveDroneSplitViewProps> = ({
  telemetry,
  selectedParcel,
  onSelectParcel,
  parcels,
  selectedDetection,
  onSelectDetection,
  isSplitScreen,
  onToggleSplitScreen,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [detections, setDetections] = useState<AIDetectionItem[]>([]);
  const [hoveredDetection, setHoveredDetection] = useState<AIDetectionItem | null>(null);
  const [showContours, setShowContours] = useState(true);
  const [showTelemetryOSD, setShowTelemetryOSD] = useState(true);
  const [showCadastralProjection, setShowCadastralProjection] = useState(true);
  const [activeCameraFilter, setActiveCameraFilter] = useState<"RGB" | "THERMAL" | "EDGE_CANNY">("RGB");
  const [viewMode, setViewMode] = useState<"SPLIT" | "PIP" | "FULL">("SPLIT");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch AI detections from server
  useEffect(() => {
    fetch("/api/drone/detections")
      .then((res) => res.json())
      .then((data) => {
        if (data.detections) {
          setDetections(data.detections);
        }
      })
      .catch((err) => console.error("Failed to load drone detections:", err));
  }, []);

  // Sync viewMode with isSplitScreen prop
  useEffect(() => {
    if (isSplitScreen && viewMode === "PIP") {
      setViewMode("SPLIT");
    }
  }, [isSplitScreen]);

  const droneAlt = telemetry?.altitude_agl ?? 48.2;
  const droneHeading = telemetry?.heading_deg ?? 45.0;
  const droneSpeed = telemetry?.speed_mps ?? 8.5;
  const droneGsd = telemetry?.gsd_cm_px ?? 1.8;
  const rtkStatus = telemetry?.rtk_status ?? "FIXED";
  const satellites = telemetry?.satellites_tracked ?? 22;

  // Handle clicking a building in the video stream
  const handleDetectionClick = (det: AIDetectionItem) => {
    onSelectDetection(det);
    if (det.linkedParcelId) {
      const match = parcels.find((p) => p.id === det.linkedParcelId);
      if (match) {
        onSelectParcel(match);
      }
    }
  };

  return (
    <div
      className={`relative flex flex-col bg-slate-950 border-slate-800 text-slate-100 overflow-hidden font-sans transition-all duration-300 select-none shadow-2xl ${
        viewMode === "PIP"
          ? "absolute bottom-16 right-4 z-[450] w-96 h-64 rounded-2xl border-2 border-sky-500/70 shadow-sky-950/80"
          : viewMode === "FULL"
          ? "w-full h-full"
          : "w-full lg:w-[48%] h-full border-r border-slate-800"
      }`}
    >
      {/* 1. HUD Top Bar */}
      <div className="shrink-0 px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-xs backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE DRONE FEED</span>
          </div>
          <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono">
            Sony A7R IV • 35mm F2.8
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            RTK {rtkStatus} ({satellites} SATS)
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Filter Toggles */}
          <button
            onClick={() => setShowContours((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition flex items-center gap-1 ${
              showContours
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
            title="Toggle AI Building & Object Detection Contours"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">AI Objects</span>
          </button>

          <button
            onClick={() => setShowCadastralProjection((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition flex items-center gap-1 ${
              showCadastralProjection
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
            title="Toggle Cadastral Boundary Line Overlay on Video"
          >
            <Layers className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Parcel Lines</span>
          </button>

          {/* View mode buttons */}
          <button
            onClick={() => {
              if (viewMode === "SPLIT") {
                setViewMode("PIP");
              } else {
                setViewMode("SPLIT");
                if (!isSplitScreen) onToggleSplitScreen();
              }
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={viewMode === "PIP" ? "Expand to Split-Screen" : "Dock as Picture-in-Picture"}
          >
            {viewMode === "PIP" ? (
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5 text-slate-300" />
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
              title="Close Live Video Stream"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Video Feed & Synthetic Aerial Canvas */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center">
        {/* Synthetic Photorealistic Aerial Canvas simulating down-looking 4K drone sensor */}
        <div
          className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
            activeCameraFilter === "THERMAL"
              ? "filter hue-rotate-180 contrast-125"
              : activeCameraFilter === "EDGE_CANNY"
              ? "filter invert contrast-200 grayscale"
              : ""
          }`}
          style={{
            backgroundImage: `radial-gradient(ellipse at center, rgba(15, 23, 42, 0.4) 0%, rgba(2, 6, 23, 0.95) 100%), url('https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1600&q=80')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Crosshair Center Reticle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-28 h-28 border border-sky-400/30 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-sky-400/80 animate-ping" />
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              {/* Corner ticks */}
              <span className="absolute -top-3 w-0.5 h-2 bg-sky-400/60" />
              <span className="absolute -bottom-3 w-0.5 h-2 bg-sky-400/60" />
              <span className="absolute -left-3 w-2 h-0.5 bg-sky-400/60" />
              <span className="absolute -right-3 w-2 h-0.5 bg-sky-400/60" />
            </div>
          </div>

          {/* Roll/Pitch Gimbal Artificial Horizon Ladder */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-6 opacity-30 text-[9px] font-mono text-sky-400">
            <div className="w-20 border-t border-dashed border-sky-400" />
            <div className="w-14 border-t border-sky-400" />
            <div className="w-20 border-t border-dashed border-sky-400" />
          </div>

          {/* Georeferenced Cadastral Boundaries Projected into Video Frame */}
          {showCadastralProjection && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 800 600">
              {/* Historical Parcel Boundary 142/101A (Fixed thin sky outline) */}
              <polygon
                points="220,130 460,130 460,430 220,430"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                opacity="0.85"
              />
              <text x="230" y="150" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                CADASTRAL: Survey 142/101A (1967 FMB)
              </text>

              {/* Adjoining Parcel Boundary 142/102 */}
              <polygon
                points="490,130 720,130 720,430 490,430"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                opacity="0.75"
              />
              <text x="500" y="150" fill="#0284c7" fontSize="10" fontFamily="monospace" fontWeight="bold">
                CADASTRAL: Survey 142/102
              </text>

              {/* Sub-division Boundary 142/103 */}
              <polygon
                points="220,440 460,440 460,570 220,570"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                opacity="0.75"
              />
            </svg>
          )}

          {/* AI Perception Overlays: Individual Detected Buildings & Objects */}
          {showContours && (
            <div className="absolute inset-0 z-15">
              {detections.map((det) => {
                const isSelected = selectedDetection?.id === det.id;
                const isHovered = hoveredDetection?.id === det.id;
                const isBuilding = det.type === "BUILDING";
                const isDispute = det.multiParcelCrossing || det.status === "DISPUTED";

                // Map to 800x600 responsive box based on imagePolygon
                const imgPoly = det.imagePolygon || [
                  [280, 260],
                  [410, 260],
                  [410, 390],
                  [280, 390],
                ];

                const minX = Math.min(...imgPoly.map((p) => p[0]));
                const maxX = Math.max(...imgPoly.map((p) => p[0]));
                const minY = Math.min(...imgPoly.map((p) => p[1]));
                const maxY = Math.max(...imgPoly.map((p) => p[1]));

                const leftPct = (minX / 800) * 100;
                const topPct = (minY / 600) * 100;
                const widthPct = ((maxX - minX) / 800) * 100;
                const heightPct = ((maxY - minY) / 600) * 100;

                return (
                  <div
                    key={det.id}
                    onClick={() => handleDetectionClick(det)}
                    onMouseEnter={() => setHoveredDetection(det)}
                    onMouseLeave={() => setHoveredDetection(null)}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    className={`absolute cursor-pointer rounded transition-all duration-200 group ${
                      isDispute
                        ? "border-2 border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/40"
                        : isSelected
                        ? "border-2 border-sky-400 bg-sky-500/25 ring-4 ring-sky-400/60 scale-105 z-30"
                        : isBuilding
                        ? "border border-amber-400/90 bg-amber-500/10 hover:border-amber-300 hover:bg-amber-500/20"
                        : "border border-emerald-400/70 bg-emerald-500/10 hover:border-emerald-300"
                    }`}
                  >
                    {/* Corner Reticle Accents for Computer Vision Bounding Box */}
                    <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
                    <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
                    <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />

                    {/* AI Label & Measurement Pill */}
                    <div
                      className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap shadow-md flex items-center gap-1 backdrop-blur-md ${
                        isDispute
                          ? "bg-rose-950 text-rose-300 border border-rose-600"
                          : isSelected
                          ? "bg-sky-600 text-white border border-sky-300 scale-105"
                          : isBuilding
                          ? "bg-slate-900/95 text-amber-300 border border-amber-500/50"
                          : "bg-slate-900/95 text-emerald-300 border border-emerald-500/50"
                      }`}
                    >
                      <span>{det.id}</span>
                      <span className="text-[8px] opacity-75 font-normal">
                        ({Math.round(det.confidence * 100)}% conf • {det.areaSqM}m²)
                      </span>
                      {isDispute && <AlertTriangle className="w-2.5 h-2.5 text-rose-400 animate-pulse" />}
                    </div>

                    {/* Hover detail badge */}
                    {(isHovered || isSelected) && (
                      <div className="absolute top-full left-0 mt-1 z-40 bg-slate-950/95 border border-sky-500/80 rounded-lg p-2 text-[10px] text-slate-200 shadow-2xl backdrop-blur-lg w-56 font-sans">
                        <div className="font-bold text-white flex items-center justify-between">
                          <span>{det.label}</span>
                          <span className="text-sky-400 font-mono text-[9px]">{det.trackId}</span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-slate-300 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Class:</span>
                            <span className="font-mono text-amber-300">{det.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Area:</span>
                            <span className="font-mono">{det.areaSqM} m²</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Height:</span>
                            <span className="font-mono">{det.heightMeters || 6.5} m</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Position Uncertainty:</span>
                            <span className="font-mono text-emerald-300">
                              ±{det.positionUncertaintyMeters ?? 0.42}m
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Spatial Status:</span>
                            <span
                              className={`font-bold ${
                                det.multiParcelCrossing ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {det.multiParcelCrossing
                                ? "Crosses Parcel Boundary"
                                : "100% Inside Cadastral Parcel"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-slate-800 text-[9px] text-sky-300 flex items-center gap-1 font-mono">
                          <span>Click to synchronize GIS Map</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* OSD (On-Screen Display) Telemetry HUD Overlays */}
          {showTelemetryOSD && (
            <>
              {/* Top-Left Flight Metrics HUD */}
              <div className="absolute top-3 left-3 z-20 bg-slate-950/85 border border-slate-700/80 rounded-xl p-2.5 shadow-xl backdrop-blur-md text-[10px] font-mono space-y-1">
                <div className="text-slate-400 flex items-center gap-1.5 border-b border-slate-800 pb-1 mb-1 font-sans font-bold text-xs text-white">
                  <Plane className="w-3.5 h-3.5 text-sky-400" />
                  <span>UAV SENSOR TELEMETRY</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">ALTITUDE (AGL):</span>
                  <span className="font-bold text-sky-300">{droneAlt.toFixed(1)} m</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">GSD RESOLUTION:</span>
                  <span className="font-bold text-emerald-300">{droneGsd.toFixed(1)} cm/px</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">GROUND SPEED:</span>
                  <span className="font-bold text-slate-200">{droneSpeed.toFixed(1)} m/s</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">HEADING (TRUE):</span>
                  <span className="font-bold text-amber-300">{Math.round(droneHeading)}° NE</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">POSITION ERROR:</span>
                  <span className="font-bold text-emerald-400">±0.018 m (RTK)</span>
                </div>
              </div>

              {/* Bottom-Left Compass & Coordinates */}
              <div className="absolute bottom-3 left-3 z-20 bg-slate-950/85 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-xl backdrop-blur-md text-[10px] font-mono text-slate-300 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Crosshair className="w-3 h-3 text-sky-400" />
                  <span>
                    {telemetry?.latitude?.toFixed(6) ?? "12.983900"}° N,{" "}
                    {telemetry?.longitude?.toFixed(6) ?? "80.209000"}° E
                  </span>
                </div>
                <span className="text-slate-600">|</span>
                <span className="text-sky-300">WGS84 • UTM 44N</span>
              </div>

              {/* Bottom-Right Active Target Card */}
              {selectedDetection && (
                <div className="absolute bottom-3 right-3 z-20 bg-slate-900/95 border border-amber-500/80 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-[11px] max-w-xs font-sans">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>SELECTED: {selectedDetection.id}</span>
                    </span>
                    <button
                      onClick={() => onSelectDetection(null)}
                      className="text-slate-400 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-slate-200 font-semibold text-xs mt-0.5">
                    {selectedDetection.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center justify-between">
                    <span>Area: {selectedDetection.areaSqM} m²</span>
                    <span className="text-emerald-400">Confidence: {Math.round(selectedDetection.confidence * 100)}%</span>
                  </div>
                  <div className="mt-1 text-[10px] text-sky-300 border-t border-slate-800 pt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>Synchronized with Cadastral Map (Survey 142)</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3. Bottom Control & Synchronized Status Bar */}
      <div className="shrink-0 px-3 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? "Pause UAV" : "Resume UAV"}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-300">
            <span className="text-slate-500">PROJECTION:</span>
            <span className="text-emerald-400">RAY-TERRAIN (FLAT+DEM)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400">Detections:</span>
          <span className="font-bold font-mono text-amber-300">{detections.length} Physical Objects</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Parcels:</span>
          <span className="font-bold font-mono text-sky-300">{parcels.length} Fixed</span>
        </div>
      </div>
    </div>
  );
};
