import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Layers,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Parcel, TopologyReport, ActiveLayers } from "../types";
import { TopologyValidationResult } from "../lib/topologyValidation";

interface ParcelBoundaryHealthLegendProps {
  parcels: Parcel[];
  topologyReport: TopologyReport | null;
  activeLayers: ActiveLayers;
  isSurveyorEditing?: boolean;
  effectiveValidation?: TopologyValidationResult | null;
  selectedParcel?: Parcel | null;
  onSelectParcelFilter?: (filter: "ALL" | "VALID" | "OVERLAP" | "INTERSECTION") => void;
}

export const ParcelBoundaryHealthLegend: React.FC<ParcelBoundaryHealthLegendProps> = ({
  parcels,
  topologyReport,
  activeLayers,
  isSurveyorEditing = false,
  effectiveValidation = null,
  selectedParcel = null,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"HEALTH" | "ZONING">("HEALTH");

  // Dynamically compute boundary health statistics across the parcel dataset
  const stats = React.useMemo(() => {
    let validCount = 0;
    let overlapCount = 0;
    let intersectionCount = 0;

    parcels.forEach((p) => {
      const report = topologyReport?.individualReports?.find((r) => r.id === p.id);
      const hasSelfInt = report ? report.hasSelfIntersection : false;
      const isOverlap =
        p.encroachmentDetected ||
        (topologyReport?.overlaps?.some(
          (o) => o.parcelAUprn === p.uprn || o.parcelBUprn === p.uprn
        ) ?? false);

      if (hasSelfInt) {
        intersectionCount++;
      } else if (isOverlap) {
        overlapCount++;
      } else {
        validCount++;
      }
    });

    const totalCount = parcels.length;
    const healthPercentage =
      totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 100;

    return {
      validCount,
      overlapCount,
      intersectionCount,
      totalCount,
      healthPercentage,
    };
  }, [parcels, topologyReport]);

  // Overall system health badge color
  const overallColor =
    stats.intersectionCount > 0
      ? "text-rose-400 border-rose-500/40 bg-rose-950/40"
      : stats.overlapCount > 0
      ? "text-amber-400 border-amber-500/40 bg-amber-950/40"
      : "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";

  return (
    <div
      id="parcel-boundary-health-legend"
      aria-label="Parcel Boundary Health Legend"
      className="absolute bottom-4 left-4 z-[500] bg-slate-900/95 border border-slate-800 text-slate-300 rounded-xl shadow-2xl backdrop-blur-md max-w-xs w-72 pointer-events-auto transition-all duration-200 select-none"
    >
      {/* Legend Header & Collapse Toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-semibold text-xs text-slate-100 truncate">
            Cadastral QC Legend
          </span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${overallColor} shrink-0`}
          >
            {stats.healthPercentage}% OK
          </span>
        </div>

        <button
          id="btn-toggle-legend-collapse"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
          title={isCollapsed ? "Expand Legend" : "Collapse Legend"}
          aria-label={isCollapsed ? "Expand Legend" : "Collapse Legend"}
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsed Pill View */}
      {isCollapsed ? (
        <div className="flex items-center justify-around px-3 py-1.5 text-[11px] font-mono bg-slate-950/50 rounded-b-xl">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{stats.validCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>{stats.overlapCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>{stats.intersectionCount}</span>
          </div>
        </div>
      ) : (
        <div className="p-2.5 space-y-2.5 text-xs">
          {/* Mode Switcher (Boundary Health vs Zoning) */}
          <div className="grid grid-cols-2 gap-1 bg-slate-950/70 p-0.5 rounded-lg border border-slate-800/80 text-[11px] font-medium">
            <button
              id="legend-tab-health"
              onClick={() => setActiveTab("HEALTH")}
              className={`py-1 px-2 rounded-md transition text-center flex items-center justify-center gap-1.5 ${
                activeTab === "HEALTH"
                  ? "bg-slate-800 text-sky-300 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-sky-400" />
              <span>Boundary Health</span>
            </button>
            <button
              id="legend-tab-zoning"
              onClick={() => setActiveTab("ZONING")}
              className={`py-1 px-2 rounded-md transition text-center flex items-center justify-center gap-1.5 ${
                activeTab === "ZONING"
                  ? "bg-slate-800 text-sky-300 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3 h-3 text-teal-400" />
              <span>Zoning / Land</span>
            </button>
          </div>

          {/* TAB 1: BOUNDARY HEALTH METRICS */}
          {activeTab === "HEALTH" && (
            <div className="space-y-1.5">
              {/* Green: Valid */}
              <div
                id="legend-health-valid"
                className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/40 transition group"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  </span>
                  <div>
                    <div className="font-semibold text-emerald-300 text-[11px] leading-tight">
                      Valid Boundaries
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      Topologically planar &amp; sound
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {stats.validCount}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({Math.round((stats.validCount / (stats.totalCount || 1)) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Yellow: Overlaps & Encroachments */}
              <div
                id="legend-health-overlap"
                className="flex items-center justify-between p-1.5 rounded-lg bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/40 transition group"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 shadow-sm shadow-amber-400/50" />
                  </span>
                  <div>
                    <div className="font-semibold text-amber-300 text-[11px] leading-tight">
                      Boundary Overlaps
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      Disputed edge or setback encroachment
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-amber-400 text-xs">
                    {stats.overlapCount}
                  </span>
                  {stats.overlapCount > 0 && (
                    <span className="text-[9px] font-mono text-amber-400/90 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 ml-1">
                      Alert
                    </span>
                  )}
                </div>
              </div>

              {/* Red: Intersections */}
              <div
                id="legend-health-intersection"
                className="flex items-center justify-between p-1.5 rounded-lg bg-rose-950/20 border border-rose-500/20 hover:border-rose-500/40 transition group"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3 shrink-0">
                    {stats.intersectionCount > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    )}
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 shadow-sm shadow-rose-500/50" />
                  </span>
                  <div>
                    <div className="font-semibold text-rose-300 text-[11px] leading-tight">
                      Self-Intersections
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      Intersecting polygon edge loops
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-400 text-xs">
                    {stats.intersectionCount}
                  </span>
                  {stats.intersectionCount > 0 && (
                    <span className="text-[9px] font-mono text-rose-400/90 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 ml-1">
                      Error
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ZONING & UNCERTAINTY SYMBOLOGY */}
          {activeTab === "ZONING" && (
            <div>
              {activeLayers.uncertaintyBands ? (
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                    <span>Low Uncertainty (&gt;80% Conf)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-amber-500 shrink-0" />
                    <span>Moderate Ambiguity (Shadow/Tree)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-rose-500 shrink-0" />
                    <span>High Uncertainty (Ground Inspection)</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
                    <span className="truncate">Residential</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
                    <span className="truncate">Commercial</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                    <span className="truncate">Agricultural</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shrink-0" />
                    <span className="truncate">Public Commons</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SURVEYOR EDITING MODE: REAL-TIME HUD CARD */}
          {isSurveyorEditing && effectiveValidation && (
            <div
              id="legend-surveyor-live-qc"
              className={`p-2 rounded-lg border text-[11px] transition ${
                effectiveValidation.isValid
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between font-bold mb-1">
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
                  {effectiveValidation.isValid ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <AlertOctagon className="w-3 h-3 text-rose-400 animate-pulse" />
                  )}
                  Live Surveyor QC
                </span>
                <span className="text-[10px] font-mono">
                  {selectedParcel?.uprn || "Active Boundary"}
                </span>
              </div>
              <div className="text-[10px] opacity-90 leading-tight">
                {effectiveValidation.isValid ? (
                  <span>✅ Boundary geometry is compliant &amp; ready to commit</span>
                ) : (
                  <span>
                    ⚠️ {effectiveValidation.summaryMessage} (
                    {effectiveValidation.violatingVertexIndices.size} invalid vertex peg
                    {effectiveValidation.violatingVertexIndices.size > 1 ? "s" : ""})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
