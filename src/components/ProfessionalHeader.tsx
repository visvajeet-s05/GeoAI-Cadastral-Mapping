import React, { useState } from "react";
import {
  Layers,
  MapPin,
  UploadCloud,
  Download,
  Activity,
  AlertTriangle,
  Building2,
  Eye,
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { ActiveLayers } from "../types";

interface ProfessionalHeaderProps {
  activeLayers: ActiveLayers;
  onToggleLayer: (layer: keyof ActiveLayers) => void;
  onOpenIngestModal: () => void;
  onOpenStreamModal: () => void;
  onExportGeoJSON: () => void;
  streamConnected: boolean;
  onRunNetworkTopologyCheck: () => void;
  isCheckingTopology: boolean;
}

export const ProfessionalHeader: React.FC<ProfessionalHeaderProps> = ({
  activeLayers,
  onToggleLayer,
  onOpenIngestModal,
  onOpenStreamModal,
  onExportGeoJSON,
  streamConnected,
  onRunNetworkTopologyCheck,
  isCheckingTopology,
}) => {
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 text-gray-800 shadow-sm shrink-0 z-30">
      <div className="w-full px-4 py-3 flex items-center justify-between">
        {/* Left: Government Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              GeoTrace-AI
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Cadastral Management System
            </p>
          </div>
        </div>

        {/* Center: Primary Actions Grouped */}
        <div className="flex items-center gap-2">
          {/* Data Ingestion */}
          <button
            onClick={onOpenIngestModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition shadow-sm"
            title="Ingest aerial imagery or satellite data"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Ingest Data</span>
          </button>

          {/* Topology Audit */}
          <button
            onClick={onRunNetworkTopologyCheck}
            disabled={isCheckingTopology}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium border border-gray-300 transition shadow-sm"
            title="Run topology validation"
          >
            <CheckCircle2
              className={`w-4 h-4 text-green-600 ${isCheckingTopology ? "animate-spin" : ""}`}
            />
            <span>{isCheckingTopology ? "Validating..." : "Validate"}</span>
          </button>

          {/* Export */}
          <button
            onClick={onExportGeoJSON}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium border border-gray-300 transition shadow-sm"
            title="Export cadastral data"
          >
            <Download className="w-4 h-4 text-green-600" />
            <span>Export</span>
          </button>
        </div>

        {/* Right: View Controls */}
        <div className="flex items-center gap-2">
          {/* Layer Toggle - Collapsible */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
            >
              <Layers className="w-4 h-4" />
              <span>Layers</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showLayerMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Map Layers
                  </p>
                  
                  <button
                    onClick={() => onToggleLayer("vectorBoundaries")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      activeLayers.vectorBoundaries
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeLayers.vectorBoundaries ? "bg-blue-500" : "bg-gray-400"}`} />
                    <span>Parcel Boundaries</span>
                  </button>

                  <button
                    onClick={() => onToggleLayer("structuralFootprints")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      activeLayers.structuralFootprints
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Building Footprints</span>
                  </button>

                  <button
                    onClick={() => onToggleLayer("zoningColors")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      activeLayers.zoningColors
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Zoning Classification</span>
                  </button>

                  <button
                    onClick={() => onToggleLayer("topologyIssues")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      activeLayers.topologyIssues
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Topology Issues</span>
                  </button>

                  <button
                    onClick={() => onToggleLayer("uncertaintyBands")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      activeLayers.uncertaintyBands
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    <span>Uncertainty Bands</span>
                  </button>

                  <button
                    onClick={() => onToggleLayer("satelliteBasemap")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      activeLayers.satelliteBasemap
                        ? "bg-teal-50 text-teal-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>{activeLayers.satelliteBasemap ? "Satellite View" : "Street View"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stream Status */}
          <button
            onClick={onOpenStreamModal}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
            title="View live stream status"
          >
            <span className={`w-2 h-2 rounded-full ${streamConnected ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
            <span>{streamConnected ? "Live" : "Offline"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};