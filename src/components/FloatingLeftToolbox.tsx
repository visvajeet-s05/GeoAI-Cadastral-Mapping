import React from "react";
import {
  MousePointer,
  Ruler,
  Edit3,
  FileText,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  UploadCloud,
  Download,
  Plane,
  Layers,
  HelpCircle,
  Eye,
  Camera,
  FolderOpen,
} from "lucide-react";

interface FloatingLeftToolboxProps {
  activeTool: "INSPECT" | "MEASURE" | "EDIT_VERTEX";
  onSelectTool: (tool: "INSPECT" | "MEASURE" | "EDIT_VERTEX") => void;
  onOpenBlueprintModal: () => void;
  onOpenVisualComparison: () => void;
  onOpenDualStreamCockpit: () => void;
  onTriggerTestMode: () => void;
  onOpenIngestModal: () => void;
  onOpenDocumentUploadModal: () => void;
  onOpenDocumentManager?: () => void;
  onExportGeoJSON: () => void;
  isSimulatingFlight: boolean;
  onToggleFlightSimulation: () => void;
  isLayerControlOpen?: boolean;
  onToggleLayerControl?: () => void;
}

export const FloatingLeftToolbox: React.FC<FloatingLeftToolboxProps> = ({
  activeTool,
  onSelectTool,
  onOpenBlueprintModal,
  onOpenVisualComparison,
  onOpenDualStreamCockpit,
  onTriggerTestMode,
  onOpenIngestModal,
  onOpenDocumentUploadModal,
  onOpenDocumentManager,
  onExportGeoJSON,
  isSimulatingFlight,
  onToggleFlightSimulation,
  isLayerControlOpen,
  onToggleLayerControl,
}) => {
  return (
    <div className="absolute top-20 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
      {/* Primary Map Tools Glass Capsule */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/70 flex flex-col gap-1.5">
        {/* 1. Inspect / Pan Tool */}
        <button
          onClick={() => onSelectTool("INSPECT")}
          className={`p-2.5 rounded-xl transition flex items-center justify-center relative group ${
            activeTool === "INSPECT"
              ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
          title="Inspect & Select Parcels"
        >
          <MousePointer className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Inspect Parcel
          </span>
        </button>

        {/* 2. Geodesic Measure Tool */}
        <button
          onClick={() => onSelectTool("MEASURE")}
          className={`p-2.5 rounded-xl transition flex items-center justify-center relative group ${
            activeTool === "MEASURE"
              ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
          title="Measure Geodesic Distance & Area"
        >
          <Ruler className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Measure Distance &amp; Area
          </span>
        </button>

        {/* 3. Surveyor Vertex Repositioning Tool */}
        <button
          onClick={() => onSelectTool("EDIT_VERTEX")}
          className={`p-2.5 rounded-xl transition flex items-center justify-center relative group ${
            activeTool === "EDIT_VERTEX"
              ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
          title="Surveyor Peg Adjustment Mode"
        >
          <Edit3 className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Surveyor Vertex Edit
          </span>
        </button>

        {/* 4. Map Layers Drawer Toggle */}
        {onToggleLayerControl && (
          <button
            onClick={onToggleLayerControl}
            className={`p-2.5 rounded-xl transition flex items-center justify-center relative group ${
              isLayerControlOpen
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Toggle Map Layers Drawer"
          >
            <Layers className="w-4 h-4" />
            <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
              Map Layers Drawer
            </span>
          </button>
        )}
      </div>

      {/* Cadastral AI & Multi-Modal Modules Glass Capsule */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/70 flex flex-col gap-1.5">
        {/* Dual-Stream Cadastral AI Cockpit */}
        <button
          onClick={onOpenDualStreamCockpit}
          className="p-2.5 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 transition flex items-center justify-center relative group"
          title="Launch Dual-Stream AI Cockpit (FMB &times; Live UAV Feed)"
        >
          <Zap className="w-4 h-4 animate-pulse" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-amber-300 text-[11px] font-semibold px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Dual-Stream AI Cockpit
          </span>
        </button>

        {/* Historical Blueprint Modal */}
        <button
          onClick={onOpenBlueprintModal}
          className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center justify-center relative group"
          title="Inspect Official Government FMB / TSLR Blueprints"
        >
          <FileText className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            FMB Blueprint Ingestion
          </span>
        </button>

        {/* Multi-Temporal Visual Comparison Slider */}
        <button
          onClick={onOpenVisualComparison}
          className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center justify-center relative group"
          title="1967 vs 2026 Multi-Temporal Swipe Comparison"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Multi-Temporal Comparison
          </span>
        </button>

        {/* Velachery Pilot Preset */}
        <button
          onClick={onTriggerTestMode}
          className="p-2.5 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition flex items-center justify-center relative group"
          title="Load Velachery, Chennai Pilot Demonstration"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-emerald-300 text-[11px] font-semibold px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Velachery Pilot Demo
          </span>
        </button>
      </div>

      {/* Ingestion & Export Capsule */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/70 flex flex-col gap-1.5">
        <button
          onClick={onOpenDocumentUploadModal}
          className="p-2.5 rounded-xl text-sky-400 hover:text-sky-300 hover:bg-sky-500/20 transition flex items-center justify-center relative group"
          title="Upload Government & Historical Documents"
        >
          <UploadCloud className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-sky-300 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Upload Document
          </span>
        </button>

        {onOpenDocumentManager && (
          <button
            onClick={onOpenDocumentManager}
            className="p-2.5 rounded-xl text-teal-400 hover:text-teal-300 hover:bg-teal-500/20 transition flex items-center justify-center relative group"
            title="Document Manager - View Uploaded Documents"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-teal-300 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
              Document Manager
            </span>
          </button>
        )}

        <button
          onClick={onOpenIngestModal}
          className="p-2.5 rounded-xl text-sky-400 hover:text-sky-300 hover:bg-sky-500/20 transition flex items-center justify-center relative group"
          title="Ingest Aerial Orthomosaic or Satellite Bounding Box"
        >
          <UploadCloud className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-sky-300 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Ingest Orthomosaic
          </span>
        </button>

        <button
          onClick={onExportGeoJSON}
          className="p-2.5 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition flex items-center justify-center relative group"
          title="Export GeoJSON FeatureCollection"
        >
          <Download className="w-4 h-4" />
          <span className="absolute left-14 bg-slate-950/95 border border-slate-700 text-emerald-300 text-[11px] font-medium px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
            Export GeoJSON
          </span>
        </button>
      </div>
    </div>
  );
};
