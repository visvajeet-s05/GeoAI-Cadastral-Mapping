import React from "react";
import {
  Layers,
  MapPin,
  Plane,
  UploadCloud,
  Download,
  Activity,
  AlertTriangle,
  Building2,
  Eye,
  CheckCircle2,
  BarChart3,
  Sliders,
  Flame,
} from "lucide-react";
import { ActiveLayers } from "../types";

interface HeaderProps {
  activeLayers: ActiveLayers;
  onToggleLayer: (layer: keyof ActiveLayers) => void;
  onOpenIngestModal: () => void;
  onOpenStreamModal: () => void;
  onExportGeoJSON: () => void;
  streamConnected: boolean;
  onRunNetworkTopologyCheck: () => void;
  isCheckingTopology: boolean;
  showMetricsBar?: boolean;
  onToggleMetricsBar?: () => void;
  showDroneHUD?: boolean;
  onToggleDroneHUD?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeLayers,
  onToggleLayer,
  onOpenIngestModal,
  onOpenStreamModal,
  onExportGeoJSON,
  streamConnected,
  onRunNetworkTopologyCheck,
  isCheckingTopology,
  showMetricsBar = true,
  onToggleMetricsBar,
  showDroneHUD = true,
  onToggleDroneHUD,
}) => {
  return (
    <header className="bg-slate-900/95 border-b border-slate-800 text-slate-100 shadow-md shrink-0 z-30">
      <div className="w-full px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 min-h-[50px]">
        {/* Left: Brand & Telemetry Status */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-inner border border-sky-400/30">
            <Building2 className="w-4 h-4 text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              GEOTRACE-AI
              <span className="hidden xl:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                Cadastral GeoAI
              </span>
            </span>

            {/* Stream indicator badge */}
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono cursor-pointer hover:border-slate-700 transition"
              onClick={onOpenStreamModal}
              title="Click to view live drone stream HUD"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  streamConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="text-slate-300 font-semibold">
                {streamConnected ? "LIVE PERCEPTION" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Integrated Active Overlays Segmented Group */}
        <div className="flex items-center bg-slate-950/70 border border-slate-800/80 rounded-lg p-0.5 text-xs overflow-x-auto max-w-full">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 hidden lg:inline-flex items-center gap-1">
            <Layers className="w-3 h-3 text-sky-400" />
            Layers:
          </span>

          {/* Vectors */}
          <button
            id="toggle-layer-boundaries"
            onClick={() => onToggleLayer("vectorBoundaries")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.vectorBoundaries
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle Parcel Vector Boundaries"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeLayers.vectorBoundaries ? "bg-sky-400" : "bg-slate-600"
              }`}
            />
            <span>Vectors</span>
          </button>

          {/* Footprints */}
          <button
            id="toggle-layer-footprints"
            onClick={() => onToggleLayer("structuralFootprints")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.structuralFootprints
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle YOLOv8 Building Footprints"
          >
            <Building2 className="w-3 h-3" />
            <span>Footprints</span>
          </button>

          {/* Uncertainty */}
          <button
            id="toggle-layer-uncertainty"
            onClick={() => onToggleLayer("uncertaintyHeatmap")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.uncertaintyHeatmap
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle Epistemic/Aleatoric Uncertainty Heatmap"
          >
            <Activity className="w-3 h-3 text-amber-400" />
            <span>Uncertainty</span>
          </button>

          {/* Zoning */}
          <button
            id="toggle-layer-zoning"
            onClick={() => onToggleLayer("zoningColors")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.zoningColors
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle Zoning Classification Colors"
          >
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>Zoning</span>
          </button>

          {/* Disputes */}
          <button
            id="toggle-layer-topology"
            onClick={() => onToggleLayer("topologyIssues")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.topologyIssues
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle Overlap & Encroachment Alerts"
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Disputes</span>
          </button>

          {/* D3 Encroachment Drift Heatmap */}
          <button
            id="toggle-layer-drift-heatmap"
            onClick={() => onToggleLayer("discrepancyHeatmap")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.discrepancyHeatmap
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle D3 Encroachment Drift Density Heatmap (Satellite vs Legal Record)"
          >
            <Flame className={`w-3 h-3 ${activeLayers.discrepancyHeatmap ? "text-rose-400 animate-pulse" : "text-slate-500"}`} />
            <span>Drift Heatmap</span>
          </button>

          {/* Satellite switch */}
          <button
            id="toggle-basemap-satellite"
            onClick={() => onToggleLayer("satelliteBasemap")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 whitespace-nowrap ${
              activeLayers.satelliteBasemap
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
            title="Toggle Satellite Imagery vs Vector Streets"
          >
            <Eye className="w-3 h-3 text-teal-400" />
            <span>{activeLayers.satelliteBasemap ? "Satellite" : "Streets"}</span>
          </button>
        </div>

        {/* Right: Primary Tools & View Toggles */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Topology Audit */}
          <button
            id="btn-network-topology-check"
            onClick={onRunNetworkTopologyCheck}
            disabled={isCheckingTopology}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            title="Run Shapely topological integrity verification"
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 text-sky-400 ${isCheckingTopology ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {isCheckingTopology ? "Validating..." : "Topology Audit"}
            </span>
          </button>

          {/* Drone Stream HUD */}
          <button
            id="btn-stream-flight"
            onClick={onOpenStreamModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/60 text-xs font-medium text-indigo-200 border border-indigo-700/40 transition"
            title="Open Live Drone Stream & Telemetry HUD"
          >
            <Plane className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Stream HUD</span>
          </button>

          {/* Ingest Orthomosaic */}
          <button
            id="btn-ingest-drone"
            onClick={onOpenIngestModal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-sm transition"
            title="Ingest drone aerial orthomosaic or satellite bounding box"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Ingest</span>
          </button>

          {/* Export GeoJSON */}
          <button
            id="btn-export-geojson"
            onClick={onExportGeoJSON}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            title="Export full cadastral parcel database as GeoJSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Export</span>
          </button>

          {/* Toggle Metrics Bar */}
          {onToggleMetricsBar && (
            <button
              onClick={onToggleMetricsBar}
              className={`p-1.5 rounded-lg border transition text-xs ${
                showMetricsBar
                  ? "bg-slate-800 text-sky-400 border-slate-700"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title={showMetricsBar ? "Hide Metrics Ribbon" : "Show Metrics Ribbon"}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Toggle Telemetry HUD */}
          {onToggleDroneHUD && (
            <button
              onClick={onToggleDroneHUD}
              className={`p-1.5 rounded-lg border transition text-xs ${
                showDroneHUD
                  ? "bg-slate-800 text-sky-400 border-slate-700"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title={showDroneHUD ? "Hide Ingestion Bar" : "Show Ingestion Bar"}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
