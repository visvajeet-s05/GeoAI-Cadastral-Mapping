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

  const filteredParcels = searchQuery.trim()
    ? parcels.filter(
        (p) =>
          p.uprn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.surveyNumber && p.surveyNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <header className="w-full shrink-0 z-30 select-none bg-slate-900/95 backdrop-blur-2xl border-b border-white/10 px-4 py-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 shadow-md shadow-slate-950/60">
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-2.5 shrink-0 justify-self-start">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black tracking-tight text-white font-mono">
            GEOTRACE<span className="text-cyan-400">-AI</span>
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            PRO GIS
          </span>
        </div>
      </div>

      {/* Center / Navigation: Layer & Feature Mode Toggles */}
      <nav className="hidden md:flex items-center justify-center gap-1.5 text-xs shrink-0 justify-self-center px-2">
        {/* 1. Vector Boundaries */}
        <button
          onClick={() => onToggleLayer("vectorBoundaries")}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeLayers.vectorBoundaries
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>Parcels</span>
        </button>

        {/* 2. Historical Blueprint */}
        <button
          onClick={() => onToggleLayer("legalGovLayout")}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeLayers.legalGovLayout
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>FMB Blueprint</span>
        </button>

        {/* 3. Discrepancy Heatmap */}
        <button
          onClick={() => onToggleLayer("discrepancyOverlay")}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeLayers.discrepancyOverlay
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Discrepancies</span>
        </button>

        {/* 4. Simulated UAV Drone Stream */}
        <button
          onClick={onToggleFlightSimulation}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            isSimulatingFlight
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <Plane className="w-3.5 h-3.5 shrink-0" />
          <span>{isSimulatingFlight ? "UAV Active" : "Simulate UAV"}</span>
          {isSimulatingFlight && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
        </button>

        {/* 5. Dual-Stream Cadastral AI Cockpit Trigger */}
        <button
          onClick={onOpenDualStreamCockpit}
          className="px-3 py-1.5 rounded-xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white shadow-md shadow-sky-600/30 border border-sky-400/30 transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
          <span>Dual-Stream AI</span>
        </button>
      </nav>

      {/* Right: Quick Tools & Search */}
      <div className="flex items-center gap-1.5 shrink-0 justify-self-end">
        {/* 1. Map Layers Drawer Toggle */}
        {onToggleLayerControl && (
          <button
            onClick={onToggleLayerControl}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1.5 whitespace-nowrap ${
              isLayerControlOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
            }`}
            title="Toggle Map Layers Drawer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">Layers</span>
          </button>
        )}

        {/* 2. Hierarchical Search Drawer Toggle */}
        {onToggleHierarchicalSearch && (
          <button
            onClick={onToggleHierarchicalSearch}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1.5 whitespace-nowrap ${
              isHierarchicalSearchOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
            }`}
            title="Search Land Records & Administrative Hierarchy"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden md:inline">Search Records</span>
          </button>
        )}

        {/* 3. Quick Plot Filter Input */}
        <div className="relative">
          {isSearchOpen ? (
            <div className="flex items-center bg-slate-950/90 border border-cyan-500/40 rounded-xl px-2.5 py-1 shadow-inner">
              <Search className="w-3.5 h-3.5 text-cyan-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Plot / S.No..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-400 focus:outline-none w-28 sm:w-36 font-mono"
                autoFocus
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  onSearchChange("");
                }}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/70 transition flex items-center gap-1.5 text-xs font-mono border border-transparent whitespace-nowrap"
              title="Quick search plot list"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="hidden lg:inline">Quick Plot</span>
            </button>
          )}

          {/* Search Dropdown Results */}
          {isSearchOpen && filteredParcels.length > 0 && (
            <div className="absolute top-11 right-0 bg-slate-900/98 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-2xl p-2 w-72 max-h-64 overflow-y-auto space-y-1 z-50">
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
      </div>
    </header>
  );
};
