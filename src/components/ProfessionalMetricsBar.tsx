import React from "react";
import {
  ShieldCheck,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers,
  X,
} from "lucide-react";
import { Parcel, TopologyReport } from "../types";
import { formatArea } from "../lib/geoUtils";

interface ProfessionalMetricsBarProps {
  parcels: Parcel[];
  topologyReport: TopologyReport | null;
  onFilterByStatus?: (status: string | null) => void;
  selectedFilter: string | null;
  onClose?: () => void;
}

export const ProfessionalMetricsBar: React.FC<ProfessionalMetricsBarProps> = ({
  parcels,
  topologyReport,
  onFilterByStatus,
  selectedFilter,
  onClose,
}) => {
  const totalAreaSqM = parcels.reduce((sum, p) => sum + p.calculatedAreaSqMeters, 0);
  const formatted = formatArea(totalAreaSqM);

  const meanUncertainty =
    parcels.length > 0
      ? parcels.reduce((sum, p) => sum + p.overallUncertainty, 0) / parcels.length
      : 0;

  const meanCompliance =
    parcels.length > 0
      ? parcels.reduce((sum, p) => sum + p.complianceScore, 0) / parcels.length
      : 0;

  const encroachmentCount = parcels.filter((p) => p.encroachmentDetected).length;
  const certifiedCount = parcels.filter((p) => p.status === "TITLE_ISSUED").length;
  const integrityScore = topologyReport ? topologyReport.networkIntegrityScore : 85.0;

  return (
    <div className="bg-blue-50 border-b border-blue-200 text-gray-700 px-4 py-2 shrink-0 z-20">
      <div className="w-full flex items-center justify-between gap-4 text-sm">
        {/* Primary Metrics - Simplified */}
        <div className="flex items-center gap-6">
          {/* Total Area */}
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600 text-xs font-medium">Total Area:</span>
            <span className="font-semibold text-gray-900">{formatted.sqm} m²</span>
            <span className="text-xs text-gray-500">({formatted.hectares} Ha)</span>
          </div>

          {/* Parcel Count */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600 text-xs font-medium">Parcels:</span>
            <span className="font-semibold text-gray-900">{parcels.length}</span>
          </div>

          {/* Certified */}
          <button
            onClick={() => {
              if (onFilterByStatus) {
                onFilterByStatus(selectedFilter === "TITLE_ISSUED" ? null : "TITLE_ISSUED");
              }
            }}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${
              selectedFilter === "TITLE_ISSUED"
                ? "bg-green-600 text-white"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{certifiedCount} Certified</span>
            {selectedFilter === "TITLE_ISSUED" && <X className="w-3 h-3" />}
          </button>

          {/* Integrity Score */}
          <div className="flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 ${
                integrityScore >= 90
                  ? "text-green-600"
                  : integrityScore >= 75
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            />
            <span className="text-gray-600 text-xs font-medium">Integrity:</span>
            <span
              className={`font-semibold ${
                integrityScore >= 90
                  ? "text-green-700"
                  : integrityScore >= 75
                  ? "text-amber-700"
                  : "text-red-700"
              }`}
            >
              {integrityScore.toFixed(1)}%
            </span>
          </div>

          {/* Disputes */}
          <button
            onClick={() => {
              if (onFilterByStatus) {
                onFilterByStatus(selectedFilter === "DISPUTED" ? null : "DISPUTED");
              }
            }}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${
              encroachmentCount > 0
                ? selectedFilter === "DISPUTED"
                  ? "bg-red-600 text-white"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{encroachmentCount} Disputes</span>
            {selectedFilter === "DISPUTED" && <X className="w-3 h-3" />}
          </button>
        </div>

        {/* Secondary Metrics - Collapsible/Minimal */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-gray-600">Uncertainty:</span>
            <span className="font-medium text-gray-900">{meanUncertainty.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">Compliance:</span>
            <span className="font-medium text-gray-900">{Math.round(meanCompliance)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};