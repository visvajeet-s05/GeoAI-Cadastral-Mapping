import React from "react";
import {
  ShieldCheck,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Building,
  Activity,
  Layers,
  X,
} from "lucide-react";
import { Parcel, TopologyReport } from "../types";
import { formatArea } from "../lib/geoUtils";

interface TopMetricsBarProps {
  parcels: Parcel[];
  topologyReport: TopologyReport | null;
  onFilterByStatus?: (status: string | null) => void;
  selectedFilter: string | null;
  onClose?: () => void;
}

export const TopMetricsBar: React.FC<TopMetricsBarProps> = ({
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
    <div className="bg-slate-950/90 border-b border-slate-800/80 text-slate-300 px-3 sm:px-4 py-1.5 shrink-0 z-20 backdrop-blur-sm">
      <div className="w-full flex items-center justify-between gap-3 text-xs overflow-x-auto">
        {/* KPI Strip */}
        <div className="flex items-center gap-3 sm:gap-4 divide-x divide-slate-800/80 min-w-max">
          {/* KPI 1: Cadastral Area */}
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Area:</span>
            <span className="font-bold text-white font-mono">{formatted.sqm} m²</span>
            <span className="text-[10px] text-sky-400/90 font-mono hidden md:inline">
              ({formatted.hectares} Ha)
            </span>
          </div>

          {/* KPI 2: Parcels & Certified */}
          <div className="pl-3 sm:pl-4 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Parcels:</span>
            <span className="font-bold text-white font-mono">{parcels.length}</span>
            <button
              onClick={() => {
                if (onFilterByStatus) {
                  onFilterByStatus(selectedFilter === "TITLE_ISSUED" ? null : "TITLE_ISSUED");
                }
              }}
              className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full transition border ${
                selectedFilter === "TITLE_ISSUED"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                  : "text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-700/50"
              }`}
              title="Click to filter certified parcels (TITLE_ISSUED)"
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>{certifiedCount} Certified</span>
              {selectedFilter === "TITLE_ISSUED" && <X className="w-2 h-2 ml-0.5" />}
            </button>
          </div>

          {/* KPI 3: Topological Integrity */}
          <div className="pl-3 sm:pl-4 flex items-center gap-1.5">
            <CheckCircle2
              className={`w-3.5 h-3.5 shrink-0 ${
                integrityScore >= 90
                  ? "text-emerald-400"
                  : integrityScore >= 75
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            />
            <span className="text-slate-400 text-[11px]">Integrity:</span>
            <span
              className={`font-bold font-mono ${
                integrityScore >= 90
                  ? "text-emerald-400"
                  : integrityScore >= 75
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {integrityScore.toFixed(1)}%
            </span>
          </div>

          {/* KPI 4: Boundary Uncertainty */}
          <div className="pl-3 sm:pl-4 hidden sm:flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Uncertainty:</span>
            <span className="font-bold text-teal-300 font-mono">
              {meanUncertainty.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 hidden lg:inline">
              (index 0-1)
            </span>
          </div>

          {/* KPI 5: VLM Compliance */}
          <div className="pl-3 sm:pl-4 hidden md:flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Zoning Setback:</span>
            <span className="font-bold text-sky-300 font-mono">
              {Math.round(meanCompliance)}%
            </span>
          </div>

          {/* KPI 6: Disputes / Encroachments */}
          <div className="pl-3 sm:pl-4 flex items-center gap-1.5">
            <button
              onClick={() => {
                if (onFilterByStatus) {
                  onFilterByStatus(selectedFilter === "DISPUTED" ? null : "DISPUTED");
                }
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition border ${
                encroachmentCount > 0
                  ? selectedFilter === "DISPUTED"
                    ? "bg-rose-600 text-white border-rose-500 shadow-sm"
                    : "bg-rose-950/70 text-rose-300 border-rose-700/60 hover:bg-rose-900/60"
                  : "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
              }`}
              title="Click to filter disputed/encroached parcels"
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>
                {encroachmentCount} {encroachmentCount === 1 ? "Dispute" : "Disputes"}
              </span>
              {selectedFilter === "DISPUTED" && <X className="w-2.5 h-2.5 ml-0.5" />}
            </button>
          </div>
        </div>

        {/* Filter status & clear */}
        {selectedFilter && (
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700">
            <span>Filtered: <strong className="text-white">{selectedFilter}</strong></span>
            <button
              onClick={() => onFilterByStatus && onFilterByStatus(null)}
              className="text-slate-400 hover:text-white"
              title="Clear Filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
