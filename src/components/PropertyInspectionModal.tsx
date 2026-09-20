import React, { useState } from "react";
import {
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Scissors,
  Edit3,
  Layers,
  Eye,
  ZoomIn,
  Compass,
  MapPin,
  Building,
  Home,
  Check,
  Info
} from "lucide-react";
import { Parcel, ParcelStatus } from "../types";
import { getLandTypeColor } from "../lib/geoUtils";

interface PropertyInspectionModalProps {
  parcel: Parcel;
  onClose: () => void;
  onStartBoundaryEdit?: () => void;
  onSplitParcel?: (parcelId: string) => void;
  onUpdateStatus?: (parcelId: string, status: ParcelStatus) => void;
}

export const PropertyInspectionModal: React.FC<PropertyInspectionModalProps> = ({
  parcel,
  onClose,
  onStartBoundaryEdit,
  onSplitParcel,
  onUpdateStatus,
}) => {
  const [showOverlays, setShowOverlays] = useState({
    candidateBoundary: true,
    buildingFootprint: true,
    compoundWalls: true,
    setbackZone: true,
  });
  const [activeTab, setActiveTab] = useState<"ANALYSIS" | "EVIDENCE" | "ADJACENCY">("ANALYSIS");
  const [isSplitting, setIsSplitting] = useState(false);

  const confidencePct = Math.round((1.0 - (parcel.overallUncertainty || 0.13)) * 100);
  const evidenceLevel = confidencePct >= 85 ? "HIGH" : confidencePct >= 70 ? "MEDIUM" : "LOW";

  return (
    <div className="fixed inset-0 z-[650] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100 ring-1 ring-white/10">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 text-white">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white font-mono">
                  {parcel.uprn}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Target Candidate
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  S.No {parcel.surveyNumber || "142/1"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {parcel.ownerName} &bull; {parcel.village || "Velachery"}, {parcel.taluk || "Chennai"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="Close Inspection Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split View (High-Res Simulated Crop + Evidence Analysis) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Left / Center Viewport: High-Resolution Local Orthophoto Crop */}
          <div className="lg:col-span-7 bg-slate-950 p-4 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative min-h-[360px] lg:min-h-[480px]">
            {/* Top Toolbar Overlay */}
            <div className="flex items-center justify-between z-10 gap-2 mb-2">
              <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1 text-[11px] font-mono shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-semibold">SIMULATED UAV ORTHOPHOTO CROP</span>
                <span className="text-slate-500">&bull;</span>
                <span className="text-cyan-300">GSD: 1.8cm/px</span>
              </div>

              {/* Layer Visibility Toggles */}
              <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-0.5 text-xs shadow-md">
                <button
                  onClick={() => setShowOverlays((p) => ({ ...p, candidateBoundary: !p.candidateBoundary }))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition ${
                    showOverlays.candidateBoundary
                      ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Toggle Property Candidate Boundary (Cyan)"
                >
                  Boundary
                </button>
                <button
                  onClick={() => setShowOverlays((p) => ({ ...p, buildingFootprint: !p.buildingFootprint }))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition ${
                    showOverlays.buildingFootprint
                      ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Toggle Building Footprint Outline (Amber)"
                >
                  Roof
                </button>
                <button
                  onClick={() => setShowOverlays((p) => ({ ...p, compoundWalls: !p.compoundWalls }))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition ${
                    showOverlays.compoundWalls
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Toggle Compound Wall Pegs (Green)"
                >
                  Walls
                </button>
              </div>
            </div>

            {/* High-Resolution Interactive Visual Crop Container */}
            <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center group shadow-inner">
              {/* Orthophoto Simulated Texture & Visual Layers */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `radial-gradient(circle at center, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%), repeating-linear-gradient(45deg, rgba(51, 65, 85, 0.15) 0px, rgba(51, 65, 85, 0.15) 2px, transparent 2px, transparent 12px)`,
                  backgroundColor: "#0f172a",
                }}
              />

              {/* Vector SVG Overlays */}
              <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none" viewBox="0 0 400 320">
                <defs>
                  {/* Property Yard Diagonal Fill Pattern */}
                  <pattern id="yardPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="10" x2="10" y2="0" stroke="rgba(6, 182, 212, 0.15)" strokeWidth="1" />
                  </pattern>
                </defs>

                {/* Road Line Reference (South Access) */}
                <path
                  d="M 20 290 L 380 290"
                  stroke="#64748b"
                  strokeWidth="6"
                  strokeDasharray="8 6"
                  opacity="0.6"
                />
                <text x="200" y="306" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  5th Street Access Road (Public)
                </text>

                {/* Neighboring West Plot Shadow (Plot 142/2) */}
                <rect
                  x="20"
                  y="40"
                  width="70"
                  height="220"
                  fill="rgba(30, 41, 59, 0.3)"
                  stroke="#475569"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text x="55" y="150" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  West House
                </text>

                {/* Neighboring East Plot Shadow (Plot 142/3) */}
                <rect
                  x="310"
                  y="40"
                  width="70"
                  height="220"
                  fill="rgba(30, 41, 59, 0.3)"
                  stroke="#475569"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text x="345" y="150" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  East House
                </text>

                {/* 1. Candidate Property Boundary (Compound Wall Extent) */}
                {showOverlays.candidateBoundary && (
                  <polygon
                    points="110,40 290,40 290,260 110,260"
                    fill="url(#yardPattern)"
                    stroke="#06b6d4"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                )}

                {/* 2. Building Footprint (Roof) Sitting Inside the Yard */}
                {showOverlays.buildingFootprint && (
                  <g>
                    {/* Main Living Structure Footprint */}
                    <polygon
                      points="140,80 260,80 260,190 190,190 190,220 140,220"
                      fill="rgba(245, 158, 11, 0.25)"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />
                    <text x="200" y="140" fill="#fbbf24" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      House Footprint (Roof)
                    </text>
                    <text x="200" y="156" fill="#fde68a" fontSize="9" textAnchor="middle" fontFamily="monospace">
                      124.5 m²
                    </text>
                  </g>
                )}

                {/* 3. Compound Wall Boundary Pegs / Evidence Markers */}
                {showOverlays.compoundWalls && (
                  <g>
                    {/* 4 Corner Vertices */}
                    <circle cx="110" cy="40" r="5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="290" cy="40" r="5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="290" cy="260" r="5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="110" cy="260" r="5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />

                    {/* Compound Wall Labels */}
                    <text x="200" y="32" fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                      North Compound Wall (15.2m)
                    </text>
                    <text x="298" y="150" fill="#38bdf8" fontSize="9" textAnchor="start" fontFamily="monospace">
                      East Wall (22.4m)
                    </text>
                    <text x="200" y="276" fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                      Front Gate &amp; Wall (15.2m)
                    </text>
                    <text x="102" y="150" fill="#38bdf8" fontSize="9" textAnchor="end" fontFamily="monospace">
                      West Wall (22.4m)
                    </text>
                  </g>
                )}

                {/* Yard & Setback Callouts */}
                <text x="130" y="65" fill="#34d399" fontSize="8" fontFamily="monospace">
                  Rear Yard Setback: 4.2m
                </text>
                <text x="140" y="248" fill="#34d399" fontSize="8" fontFamily="monospace">
                  Front Yard / Driveway: 5.1m
                </text>
              </svg>

              {/* Bottom Annotation Badge */}
              <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">Property: 340.5 m²</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-400 font-semibold">Building: 124.5 m²</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400">Yard/Setback: 216.0 m²</span>
                </div>
                <span className="text-slate-400 text-[10px]">Building Footprint ≠ Property Boundary</span>
              </div>
            </div>

            {/* Disclaimer Bar */}
            <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-600/50 flex items-center gap-2 text-amber-200 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>AI Candidate Boundary:</strong> Derived from aerial compound walls &amp; setbacks. Statutory legal boundary requires surveyor endorsement.
              </span>
            </div>
          </div>

          {/* Right Column: Evidence Details, Metrics & Actions */}
          <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-slate-900/60 overflow-y-auto">
            {/* Top Stat Cards */}
            <div className="space-y-3">
              {/* Evidence Classification Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-3 shadow-lg ${
                  evidenceLevel === "HIGH"
                    ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
                    : evidenceLevel === "MEDIUM"
                    ? "bg-amber-950/50 border-amber-500/50 text-amber-200"
                    : "bg-rose-950/50 border-rose-500/50 text-rose-200"
                }`}
              >
                {evidenceLevel === "HIGH" ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wider font-mono">
                      {evidenceLevel} BOUNDARY EVIDENCE
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-white/10">
                      {confidencePct}% Confidence
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-90 leading-relaxed font-sans">
                    {evidenceLevel === "HIGH"
                      ? "Clear 4-sided compound wall, distinct access road frontage, and isolated single-building setback verified."
                      : "Boundary inferred from building footprint and vegetation transition. Review recommended."}
                  </p>
                </div>
              </div>

              {/* Evidence Features Checklist */}
              <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                  Physical Feature Verification Checklist
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Compound Wall / Fence line</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60">
                      4 Sides Visible
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Road Frontage &amp; Gate</span>
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-700/60">
                      South Access (15.2m)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Roof vs Yard Separation</span>
                    </span>
                    <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/60">
                      36.5% Builtup Ratio
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Neighbor Clearance (West/East)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60">
                      0.0m Overlap (Disjoint)
                    </span>
                  </div>
                </div>
              </div>

              {/* Registered Ownership & Registry Info */}
              <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                    Cadastral Registry Attributes
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">
                    PID: {parcel.geoTraceCardNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Owner Name</span>
                    <strong className="text-white font-medium">{parcel.ownerName}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Land Use Classification</span>
                    <strong className="text-cyan-300 font-mono">{parcel.landType}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Survey Area</span>
                    <strong className="text-emerald-300 font-mono">{Math.round(parcel.calculatedAreaSqMeters)} m²</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Status</span>
                    <strong className="text-amber-300 font-mono text-[10px]">{parcel.status.replace(/_/g, " ")}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Human Cadastral Review & Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                Human Cadastral Verification
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    onUpdateStatus?.(parcel.id, "ACCEPTED_AFTER_REVIEW");
                    onClose();
                  }}
                  className="py-2 px-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-500/50 font-bold text-xs flex items-center justify-center gap-1 transition shadow-sm"
                  title="Approve Candidate Boundary"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>

                <button
                  onClick={() => {
                    onUpdateStatus?.(parcel.id, "ENCROACHMENT_DISPUTE");
                    onClose();
                  }}
                  className="py-2 px-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-500/50 font-bold text-xs flex items-center justify-center gap-1 transition shadow-sm"
                  title="Flag Boundary Dispute"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Dispute</span>
                </button>

                <button
                  onClick={() => {
                    onUpdateStatus?.(parcel.id, "REQUIRES_FIELD_INSPECTION");
                    onClose();
                  }}
                  className="py-2 px-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border border-amber-500/50 font-bold text-xs flex items-center justify-center gap-1 transition shadow-sm"
                  title="Schedule Ground DGPS Survey"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Uncertain</span>
                </button>
              </div>

              {/* Action Buttons: Edit Vertex & Split Parcel */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    onClose();
                    onStartBoundaryEdit?.();
                  }}
                  className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Boundary Vertices</span>
                </button>

                <button
                  onClick={async () => {
                    if (onSplitParcel) {
                      setIsSplitting(true);
                      await onSplitParcel(parcel.id);
                      setIsSplitting(false);
                      onClose();
                    }
                  }}
                  disabled={isSplitting}
                  className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-50"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{isSplitting ? "Splitting..." : "Split Parcel Polygon"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
