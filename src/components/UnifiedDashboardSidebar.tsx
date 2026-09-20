import React from "react";
import {
  MousePointer,
  Ruler,
  Edit3,
  Layers,
  Zap,
  FileText,
  SlidersHorizontal,
  CheckCircle2,
  UploadCloud,
  FolderOpen,
  Download,
  Search,
  Plane,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface UnifiedDashboardSidebarProps {
  activeTool: "INSPECT" | "MEASURE" | "EDIT_VERTEX";
  onSelectTool: (tool: "INSPECT" | "MEASURE" | "EDIT_VERTEX") => void;
  isLayerControlOpen?: boolean;
  onToggleLayerControl?: () => void;
  isHierarchicalSearchOpen?: boolean;
  onToggleHierarchicalSearch?: () => void;
  onOpenDualStreamCockpit: () => void;
  onOpenBlueprintModal: () => void;
  onOpenVisualComparison: () => void;
  onTriggerTestMode: () => void;
  onOpenDocumentUploadModal: () => void;
  onOpenDocumentManager?: () => void;
  onOpenIngestModal: () => void;
  onExportGeoJSON: () => void;
  isSimulatingFlight: boolean;
  onToggleFlightSimulation: () => void;
}

export const UnifiedDashboardSidebar: React.FC<UnifiedDashboardSidebarProps> = ({
  activeTool,
  onSelectTool,
  isLayerControlOpen,
  onToggleLayerControl,
  isHierarchicalSearchOpen,
  onToggleHierarchicalSearch,
  onOpenDualStreamCockpit,
  onOpenBlueprintModal,
  onOpenVisualComparison,
  onTriggerTestMode,
  onOpenDocumentUploadModal,
  onOpenDocumentManager,
  onOpenIngestModal,
  onExportGeoJSON,
  isSimulatingFlight,
  onToggleFlightSimulation,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <aside
      aria-label="GIS Toolset and Navigation Sidebar"
      className={`relative z-20 shrink-0 h-full flex flex-col justify-between bg-slate-900/95 backdrop-blur-2xl border-r border-white/10 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? "w-14" : "w-16 sm:w-56"
      }`}
    >
      {/* Sidebar Tool Navigation Groups */}
      <div className="flex flex-col gap-4 p-2 overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* Section 1: Spatial & Map Tools */}
        <div>
          {!isCollapsed && (
            <div className="hidden sm:block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-2.5 mb-1.5">
              Spatial Tools
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* Inspect Tool */}
            <button
              onClick={() => onSelectTool("INSPECT")}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                activeTool === "INSPECT"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              title="Inspect & Select Plots"
            >
              <MousePointer className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Inspect Plots</span>}
            </button>

            {/* Geodesic Measure Tool */}
            <button
              onClick={() => onSelectTool("MEASURE")}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                activeTool === "MEASURE"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              title="Measure Geodesic Distance & Area"
            >
              <Ruler className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Measure Tool</span>}
            </button>

            {/* Surveyor Vertex Repositioning Tool */}
            <button
              onClick={() => onSelectTool("EDIT_VERTEX")}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                activeTool === "EDIT_VERTEX"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              title="Surveyor Peg Vertex Adjustment"
            >
              <Edit3 className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Surveyor Edit</span>}
            </button>
          </div>
        </div>

        {/* Section 2: Layers & Search Drawers */}
        <div className="pt-2 border-t border-slate-800/70">
          {!isCollapsed && (
            <div className="hidden sm:block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-2.5 mb-1.5">
              Panels &amp; Drawers
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* Map Layers Drawer */}
            {onToggleLayerControl && (
              <button
                onClick={onToggleLayerControl}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                  isLayerControlOpen
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
                title="Toggle Map Layers Panel"
              >
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                {!isCollapsed && <span className="hidden sm:inline truncate">Map Layers</span>}
              </button>
            )}

            {/* Hierarchical Land Search */}
            {onToggleHierarchicalSearch && (
              <button
                onClick={onToggleHierarchicalSearch}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                  isHierarchicalSearchOpen
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
                title="Search Land Records & Administrative Hierarchy"
              >
                <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                {!isCollapsed && <span className="hidden sm:inline truncate">Search Records</span>}
              </button>
            )}
          </div>
        </div>

        {/* Section 3: Cadastral AI & Multi-Modal */}
        <div className="pt-2 border-t border-slate-800/70">
          {!isCollapsed && (
            <div className="hidden sm:block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-2.5 mb-1.5">
              Cadastral AI
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* Dual-Stream Cadastral AI Cockpit */}
            <button
              onClick={onOpenDualStreamCockpit}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-amber-300 hover:bg-amber-500/15 transition border border-transparent hover:border-amber-500/30"
              title="Launch Dual-Stream AI Cockpit"
            >
              <Zap className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">AI Cockpit</span>}
            </button>

            {/* Historical Blueprint Modal */}
            <button
              onClick={onOpenBlueprintModal}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition border border-transparent"
              title="Inspect Official Government FMB Blueprint"
            >
              <FileText className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">FMB Blueprint</span>}
            </button>

            {/* Multi-Temporal Visual Comparison Slider */}
            <button
              onClick={onOpenVisualComparison}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition border border-transparent"
              title="1967 vs 2026 Multi-Temporal Comparison"
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Temporal Compare</span>}
            </button>

            {/* Velachery Pilot Preset */}
            <button
              onClick={onTriggerTestMode}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/15 transition border border-transparent hover:border-emerald-500/30"
              title="Load Velachery Pilot Demonstration"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Velachery Pilot</span>}
            </button>
          </div>
        </div>

        {/* Section 4: Data Ingest & Export */}
        <div className="pt-2 border-t border-slate-800/70">
          {!isCollapsed && (
            <div className="hidden sm:block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-2.5 mb-1.5">
              Data &amp; Documents
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* Upload Document */}
            <button
              onClick={onOpenDocumentUploadModal}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-sky-400 hover:bg-sky-500/15 transition border border-transparent hover:border-sky-500/30"
              title="Upload Government & Historical Documents"
            >
              <UploadCloud className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Upload Document</span>}
            </button>

            {/* Document Manager */}
            {onOpenDocumentManager && (
              <button
                onClick={onOpenDocumentManager}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-teal-400 hover:bg-teal-500/15 transition border border-transparent hover:border-teal-500/30"
                title="Document Manager"
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="hidden sm:inline truncate">Doc Manager</span>}
              </button>
            )}

            {/* Ingest Orthomosaic */}
            <button
              onClick={onOpenIngestModal}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-sky-400 hover:bg-sky-500/15 transition border border-transparent hover:border-sky-500/30"
              title="Ingest Aerial Orthomosaic Bounding Box"
            >
              <UploadCloud className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Ingest Ortho</span>}
            </button>

            {/* Export GeoJSON */}
            <button
              onClick={onExportGeoJSON}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/15 transition border border-transparent hover:border-emerald-500/30"
              title="Export GeoJSON FeatureCollection"
            >
              <Download className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Export GeoJSON</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Collapse Toggle & Simulation Quick Trigger */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-1">
        <button
          onClick={onToggleFlightSimulation}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono transition ${
            isSimulatingFlight
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
          title={isSimulatingFlight ? "UAV Flight Simulation Active" : "Start UAV Flight Simulation"}
        >
          <Plane className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && (
            <span className="hidden sm:inline text-[11px] font-bold">
              {isSimulatingFlight ? "UAV Active" : "Simulate UAV"}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition ml-auto"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
