import React from "react";
import {
  Building2,
  MapPin,
  Layers,
  FileText,
  Plane,
  AlertTriangle,
  Zap,
  Search,
  CheckCircle2,
  Radio,
  Sliders,
  Sparkles,
  Download,
  X
} from "lucide-react";
import { ActiveLayers, Parcel, UAVTelemetry } from "../types";

interface FloatingGlassTopBarProps {
  activeLayers: ActiveLayers;
  onToggleLayer: (layer: keyof ActiveLayers) => void;
  parcelsCount: number;
  telemetry: UAVTelemetry | null;
  isSimulatingFlight: boolean;
  onToggleFlightSimulation: () => void;
  onOpenDualStreamCockpit: () => void;
  onOpenBlueprintModal: () => void;
  onOpenIngestModal: () => void;
  onExportGeoJSON: () => void;
  onTriggerTestMode: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  parcels: Parcel[];
  onSelectParcel: (parcel: Parcel) => void;
  onResetGranularDemo?: () => void;
  onScanUnderSegmentation?: () => void;
  isHierarchicalSearchOpen?: boolean;
  onToggleHierarchicalSearch?: () => void;
  isLayerControlOpen?: boolean;
  onToggleLayerControl?: () => void;
}

export const FloatingGlassTopBar: React.FC<FloatingGlassTopBarProps> = ({
  activeLayers,
  onToggleLayer,
  parcelsCount,
  telemetry,
  isSimulatingFlight,
  onToggleFlightSimulation,
  onOpenDualStreamCockpit,
  onOpenBlueprintModal,
  onOpenIngestModal,
  onExportGeoJSON,
  onTriggerTestMode,
  searchQuery,
  onSearchChange,
  parcels,
  onSelectParcel,
  onResetGranularDemo,
  onScanUnderSegmentation,
  isHierarchicalSearchOpen,
  onToggleHierarchicalSearch,
  isLayerControlOpen,
  onToggleLayerControl,
}) => {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [showStatsModal, setShowStatsModal] = React.useState(false);

  const residentialCount = parcels.filter((p) => p.landType === "RESIDENTIAL").length;
  const vacantCount = parcels.filter(
    (p) => p.landType === "UNCLAIMED" || p.landType === "AGRICULTURAL" || p.structureCount === 0
  ).length;
  const highConfCount = parcels.filter((p) => (1.0 - (p.overallUncertainty || 0.15)) >= 0.85).length;
  const pendingCount = parcels.filter(
    (p) => p.status === "DRAFT_SEGMENTATION" || p.status === "TOPOLOGY_VERIFIED" || !p.reviewedBy
  ).length;

  const filteredParcels = searchQuery.trim()
    ? parcels.filter(
        (p) =>
          p.uprn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.surveyNumber && p.surveyNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="absolute top-3.5 left-4 right-4 z-30 pointer-events-none">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand & Location Selector Pill */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/85 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-1.5 shadow-2xl shadow-slate-950/60">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Building2 className="w-4 h-4 text-white" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-white font-mono">
                GEOTRACE<span className="text-cyan-400">-AI</span>
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                PRO GIS
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <MapPin className="w-2.5 h-2.5 text-rose-400" />
              <span>Velachery, Chennai &bull; S.No 142</span>
            </div>
          </div>

          {/* Dynamic Statistics Capsule Badge */}
          <div
            onClick={() => setShowStatsModal((prev) => !prev)}
            className="cursor-pointer hidden lg:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-700/60 text-[10px] font-mono font-semibold text-slate-300 hover:border-cyan-500/50 transition"
            title="Click for dataset statistics breakdown"
          >
            <span className="text-cyan-300 font-bold">{parcels.length} Plots</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-amber-300">{residentialCount} Res</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-emerald-300">{vacantCount} Vacant</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-sky-300">{highConfCount} High Conf</span>
          </div>
        </div>

        {/* Center: Floating Layer & Feature Mode Toggles */}
        <div className="hidden md:flex items-center gap-1 pointer-events-auto bg-slate-900/85 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl shadow-slate-950/60 text-xs">
          {/* 1. Vector Boundaries */}
          <button
            onClick={() => onToggleLayer("vectorBoundaries")}
            className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
              activeLayers.vectorBoundaries
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Parcels</span>
          </button>

          {/* 2. Historical Blueprint */}
          <button
            onClick={() => onToggleLayer("legalGovLayout")}
            className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
              activeLayers.legalGovLayout
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>FMB Blueprint</span>
          </button>

          {/* 3. Discrepancy Heatmap */}
          <button
            onClick={() => onToggleLayer("discrepancyOverlay")}
            className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
              activeLayers.discrepancyOverlay
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Discrepancies</span>
          </button>

          {/* 4. Simulated UAV Drone Stream */}
          <button
            onClick={onToggleFlightSimulation}
            className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
              isSimulatingFlight
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>{isSimulatingFlight ? "UAV Active" : "Simulate UAV"}</span>
            {isSimulatingFlight && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
          </button>

          {/* 5. Dual-Stream Cadastral AI Cockpit Trigger */}
          <button
            onClick={onOpenDualStreamCockpit}
            className="px-3 py-1.5 rounded-xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white shadow-md shadow-sky-600/30 border border-sky-400/30 transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Dual-Stream AI</span>
          </button>
        </div>

        {/* Right: Telemetry Badges & Quick Search */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 1. Map Layers Toggle Button */}
          {onToggleLayerControl && (
            <button
              onClick={onToggleLayerControl}
              className={`p-2 rounded-2xl backdrop-blur-xl border text-xs font-mono transition flex items-center gap-1.5 shadow-2xl ${
                isLayerControlOpen
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 ring-1 ring-cyan-500/30"
                  : "bg-slate-900/85 border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/40"
              }`}
              title="Toggle Map Layers Drawer"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Layers</span>
            </button>
          )}

          {/* 2. Hierarchical Search Drawer Toggle */}
          {onToggleHierarchicalSearch && (
            <button
              onClick={onToggleHierarchicalSearch}
              className={`p-2 rounded-2xl backdrop-blur-xl border text-xs font-mono transition flex items-center gap-1.5 shadow-2xl ${
                isHierarchicalSearchOpen
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 ring-1 ring-cyan-500/30"
                  : "bg-slate-900/85 border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/40"
              }`}
              title="Search Land Records & Administrative Hierarchy"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Search Records</span>
            </button>
          )}

          {/* 3. Quick Plot Filter Input */}
          <div className="relative">
            {isSearchOpen ? (
              <div className="flex items-center bg-slate-900/90 backdrop-blur-xl border border-cyan-500/40 rounded-2xl px-3 py-1.5 shadow-2xl">
                <Search className="w-3.5 h-3.5 text-cyan-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Plot / S.No..."
                  className="bg-transparent border-none text-xs text-white placeholder-slate-400 focus:outline-none w-36 sm:w-48 font-mono"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    onSearchChange("");
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/40 shadow-2xl transition flex items-center gap-1.5 text-xs font-mono"
                title="Quick search plot list"
              >
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Quick Plot</span>
              </button>
            )}

            {/* Search Dropdown Results */}
            {isSearchOpen && filteredParcels.length > 0 && (
              <div className="absolute top-12 right-0 bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-2xl p-2 w-72 max-h-64 overflow-y-auto space-y-1 z-50">
                {filteredParcels.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectParcel(p);
                      setIsSearchOpen(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800 cursor-pointer text-xs flex items-center justify-between transition"
                  >
                    <div>
                      <div className="font-bold text-white font-mono">{p.uprn}</div>
                      <div className="text-[10px] text-slate-400">{p.ownerName} &bull; S.No {p.surveyNumber || "142"}</div>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 font-bold">
                      {Math.round(p.calculatedAreaSqMeters)} m²
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RTK Telemetry Chip */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/85 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-1.5 shadow-2xl text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              RTK: {telemetry?.rtk_status ?? "FIXED"}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-300 font-semibold">
              GSD: {telemetry?.gsd_cm_px ?? 1.8}cm
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-300 font-bold">
              {parcelsCount} Plots
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
