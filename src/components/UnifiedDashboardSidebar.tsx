import React from "react";
import {
  MousePointer,
  Ruler,
  Edit3,
  Zap,
  SlidersHorizontal,
  FileText,
  FolderOpen,
  UploadCloud,
  Download,
  Plane,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings2,
  Layers,
  Search,
  Terminal,
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
  onTriggerTestMode?: () => void;
  onOpenDocumentUploadModal?: () => void;
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
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);

  // Handle document manager opening with fallback to document upload modal
  const handleOpenDocuments = () => {
    if (onOpenDocumentManager) {
      onOpenDocumentManager();
    } else if (onOpenDocumentUploadModal) {
      onOpenDocumentUploadModal();
    }
  };

  return (
    <aside
      id="unified-dashboard-sidebar"
      aria-label="Cadastral GIS Workflow and Data Management"
      className={`relative z-20 shrink-0 h-full flex flex-col justify-between bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? "w-14" : "w-14 sm:w-52"
      }`}
    >
      {/* Scrollable Tool Categories */}
      <div className="flex flex-col gap-3 p-2 overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* ================================================================= */}
        {/* PRIMARY SECTION: WORKFLOW                                         */}
        {/* ================================================================= */}
        <section id="sidebar-section-workflow" aria-label="Primary Workflow Tools">
          {!isCollapsed && (
            <div className="hidden sm:flex items-center justify-between px-2.5 mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              <span>Workflow</span>
              <span className="text-[9px] text-slate-400 font-mono">Core</span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* Inspect Plots */}
            <button
              id="sidebar-btn-inspect"
              onClick={() => onSelectTool("INSPECT")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition group relative ${
                activeTool === "INSPECT"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              title="Inspect Plots — View parcel attributes, ownership, and boundary data"
            >
              <MousePointer
                className={`w-4 h-4 shrink-0 transition-colors ${
                  activeTool === "INSPECT" ? "text-sky-400" : "text-slate-400 group-hover:text-slate-200"
                }`}
              />
              {!isCollapsed && (
                <div className="hidden sm:flex items-center justify-between w-full min-w-0">
                  <span className="truncate">Inspect Plots</span>
                  {activeTool === "INSPECT" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  )}
                </div>
              )}
            </button>

            {/* Geodesic Measure Tool */}
            <button
              id="sidebar-btn-measure"
              onClick={() => onSelectTool("MEASURE")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition group relative ${
                activeTool === "MEASURE"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              title="Measure Tool — Geodesic distances, side lengths, and perimeter area"
            >
              <Ruler
                className={`w-4 h-4 shrink-0 transition-colors ${
                  activeTool === "MEASURE" ? "text-sky-400" : "text-slate-400 group-hover:text-slate-200"
                }`}
              />
              {!isCollapsed && (
                <div className="hidden sm:flex items-center justify-between w-full min-w-0">
                  <span className="truncate">Measure Tool</span>
                  {activeTool === "MEASURE" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  )}
                </div>
              )}
            </button>

            {/* Surveyor Vertex & Boundary Alignment */}
            <button
              id="sidebar-btn-surveyor"
              onClick={() => onSelectTool("EDIT_VERTEX")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition group relative ${
                activeTool === "EDIT_VERTEX"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm ring-1 ring-amber-400/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              title="Surveyor Edit — Align boundary pegs and rooftop footprints with live topology QC"
            >
              <Edit3
                className={`w-4 h-4 shrink-0 transition-colors ${
                  activeTool === "EDIT_VERTEX" ? "text-amber-400" : "text-slate-400 group-hover:text-slate-200"
                }`}
              />
              {!isCollapsed && (
                <div className="hidden sm:flex items-center justify-between w-full min-w-0">
                  <span className="truncate font-semibold text-amber-300">Surveyor Edit</span>
                  {activeTool === "EDIT_VERTEX" ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  ) : (
                    <span className="text-[9px] font-mono text-amber-400/80 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                      Snap
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Dual-Stream AI Drone Vision Cockpit */}
            <button
              id="sidebar-btn-ai-cockpit"
              onClick={onOpenDualStreamCockpit}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-500/15 transition border border-transparent hover:border-amber-500/30 group"
              title="AI Cockpit — Live aerial drone vision and boundary anomaly detection"
            >
              <Zap className="w-4 h-4 text-amber-400 group-hover:scale-110 transition shrink-0" />
              {!isCollapsed && (
                <div className="hidden sm:flex items-center justify-between w-full min-w-0">
                  <span className="truncate font-medium">AI Cockpit</span>
                  <span className="text-[9px] font-mono text-amber-400 bg-amber-500/15 px-1 py-0.2 rounded border border-amber-500/30">
                    Live
                  </span>
                </div>
              )}
            </button>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECONDARY SECTION: DATA MANAGEMENT                                */}
        {/* ================================================================= */}
        <section id="sidebar-section-data-management" aria-label="Primary Data Management" className="pt-2 border-t border-slate-800/80">
          {!isCollapsed && (
            <div className="hidden sm:flex items-center justify-between px-2.5 mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              <span>Data Management</span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {/* Land Records & Document Vault */}
            <button
              id="sidebar-btn-documents"
              onClick={handleOpenDocuments}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition border border-transparent"
              title="Land Documents — Manage official revenue documents, Patta, TSLR, and FMB plans"
            >
              <FolderOpen className="w-4 h-4 text-teal-400 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Land Documents</span>}
            </button>

            {/* Ingest Aerial Orthomosaic */}
            <button
              id="sidebar-btn-ingest"
              onClick={onOpenIngestModal}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition border border-transparent"
              title="Ingest Ortho — Upload and calibrate aerial drone orthomosaic bounding box"
            >
              <UploadCloud className="w-4 h-4 text-sky-400 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Ingest Ortho</span>}
            </button>

            {/* Export Cadastral GeoJSON */}
            <button
              id="sidebar-btn-export"
              onClick={onExportGeoJSON}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition border border-transparent"
              title="Export GeoJSON — Download survey FeatureCollection with geometry and attributes"
            >
              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              {!isCollapsed && <span className="hidden sm:inline truncate">Export GeoJSON</span>}
            </button>
          </div>
        </section>

        {/* ================================================================= */}
        {/* TERTIARY SECTION: ADVANCED SUB-MENU (Administrative Tools)        */}
        {/* ================================================================= */}
        <section id="sidebar-section-advanced" aria-label="Advanced Administrative Utilities" className="pt-2 border-t border-slate-800/80">
          <button
            id="sidebar-btn-advanced-toggle"
            onClick={() => setIsAdvancedOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition group"
            title="Toggle Advanced Administrative Utilities"
            aria-expanded={isAdvancedOpen}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Settings2 className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0 transition-transform duration-200" />
              {!isCollapsed && (
                <span className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-slate-300">
                  Advanced
                </span>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isAdvancedOpen ? "rotate-180 text-sky-400" : ""
                }`}
              />
            )}
          </button>

          {/* Collapsible Administrative Sub-menu */}
          {isAdvancedOpen && (
            <div className={`mt-1 flex flex-col gap-1 ${!isCollapsed ? "pl-2 border-l border-slate-800/80 ml-3" : ""}`}>
              {/* Historical Revenue FMB Blueprint */}
              <button
                id="sidebar-btn-fmb-blueprint"
                onClick={onOpenBlueprintModal}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition border border-transparent"
                title="FMB Blueprint — Field measurement book vectors and ground measurement sketches"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                {!isCollapsed && <span className="hidden sm:inline truncate text-[11px]">FMB Blueprint</span>}
              </button>

              {/* Multi-Temporal Visual Comparison */}
              <button
                id="sidebar-btn-temporal-compare"
                onClick={onOpenVisualComparison}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition border border-transparent"
                title="Temporal Compare — 1967 revenue record vs 2026 aerial drone orthophoto"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                {!isCollapsed && <span className="hidden sm:inline truncate text-[11px]">Temporal Compare</span>}
              </button>

              {/* GIS Map Layers Drawer */}
              {onToggleLayerControl && (
                <button
                  id="sidebar-btn-layers"
                  onClick={onToggleLayerControl}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isLayerControlOpen
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                  title="Toggle GIS Map Layers"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  {!isCollapsed && <span className="hidden sm:inline truncate text-[11px]">GIS Layers</span>}
                </button>
              )}

              {/* Administrative Hierarchical Search */}
              {onToggleHierarchicalSearch && (
                <button
                  id="sidebar-btn-search"
                  onClick={onToggleHierarchicalSearch}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isHierarchicalSearchOpen
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                  title="Hierarchical District / Taluk / Village Search"
                >
                  <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  {!isCollapsed && <span className="hidden sm:inline truncate text-[11px]">Registry Search</span>}
                </button>
              )}

              {/* Diagnostic QC / Test Mode */}
              {onTriggerTestMode && (
                <button
                  id="sidebar-btn-test-mode"
                  onClick={onTriggerTestMode}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-amber-300 hover:bg-slate-800/60 transition border border-transparent"
                  title="Run Automated Diagnostic & Topological QC Tests"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {!isCollapsed && <span className="hidden sm:inline truncate text-[11px]">Diagnostics</span>}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ================================================================= */}
      {/* SIDEBAR FOOTER: UAV SIMULATION PATROL & COLLAPSE TOGGLE            */}
      {/* ================================================================= */}
      <footer id="sidebar-footer" className="p-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-1">
        <button
          id="sidebar-btn-uav-sim"
          onClick={onToggleFlightSimulation}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono transition ${
            isSimulatingFlight
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
          }`}
          title={isSimulatingFlight ? "UAV Flight Patrol Active — Click to pause" : "Simulate Drone Aerial Survey Flight"}
        >
          <Plane
            className={`w-3.5 h-3.5 shrink-0 ${
              isSimulatingFlight ? "text-emerald-400 animate-pulse" : "text-slate-400"
            }`}
          />
          {!isCollapsed && (
            <span className="hidden sm:inline text-[11px] font-bold">
              {isSimulatingFlight ? "UAV Active" : "Simulate UAV"}
            </span>
          )}
        </button>

        <button
          id="sidebar-btn-collapse"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition ml-auto"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </footer>
    </aside>
  );
};


