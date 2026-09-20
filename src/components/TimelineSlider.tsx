import React, { useState, useEffect } from "react";
import {
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  BarChart3,
  Map,
  CheckCircle2,
  AlertTriangle,
  Info,
  TrendingUp,
  GitMerge,
  Calendar,
} from "lucide-react";
import type {
  FmbPlanHistoricalDataset,
  PlotCongruenceRecord,
  TimelineEpoch,
  TemporalComparisonResult,
} from "../types";

export interface TimelineSliderProps {
  isOpen: boolean;
  onClose: () => void;
  surveyNumber?: string;
  dataset?: FmbPlanHistoricalDataset | null;
}

interface EpochData {
  year: number;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  isOpen,
  onClose,
  surveyNumber = "142",
  dataset,
}) => {
  const [epochs, setEpochs] = useState<EpochData[]>([
    { year: 1967, label: "1967 FMB Survey", description: "Original Re-survey Field Measurement Book", color: "from-amber-500 to-amber-600", icon: <Calendar className="w-4 h-4" /> },
    { year: 1975, label: "1975 Revenue Mutation", description: "Patta Transfer Records & Adangal Updates", color: "from-orange-500 to-orange-600", icon: <Calendar className="w-4 h-4" /> },
    { year: 1985, label: "1985 Subdivision Layout", description: "Panchayat / DTCP Layout Plan", color: "from-yellow-500 to-yellow-600", icon: <Calendar className="w-4 h-4" /> },
    { year: 2005, label: "2005 TSLR Digital", description: "Computerized Town Survey Land Register", color: "from-lime-500 to-lime-600", icon: <Calendar className="w-4 h-4" /> },
    { year: 2018, label: "2018 CMDA Layout", description: "Approved Layout Plan (CMDA)", color: "from-cyan-500 to-cyan-600", icon: <Calendar className="w-4 h-4" /> },
    { year: 2026, label: "2026 Satellite Detected", description: "High-Resolution Satellite Physical Boundary", color: "from-sky-500 to-blue-600", icon: <Calendar className="w-4 h-4" /> },
  ]);

  const [timelineNodes, setTimelineNodes] = useState<TimelineEpoch[]>([]);
  const [temporalChanges, setTemporalChanges] = useState<TemporalComparisonResult[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<number>(1967);
  const [targetEpoch, setTargetEpoch] = useState<number>(2026);
  const [isLoading, setIsLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const [localDataset, setLocalDataset] = useState<FmbPlanHistoricalDataset | null>(dataset);

  useEffect(() => {
    if (dataset) {
      setLocalDataset(dataset);
    } else if (surveyNumber) {
      fetchTimeline();
    }
  }, [dataset, surveyNumber]);

  const fetchTimeline = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/historical/timeline/${surveyNumber}`);
      const data = await res.json();
      if (data.timelineNodes) {
        setTimelineNodes(data.timelineNodes);
      }
      if (data.temporalChanges) {
        // Transform to TemporalComparisonResult-compatible shape
        const changes = data.temporalChanges.map((tc: any) => ({
          ...tc,
          fromCoordinates: [],
          toCoordinates: [],
        }));
        setTemporalChanges(changes);
      }
    } catch (e) {
      console.error("Failed to fetch timeline:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareEpochs = async () => {
    if (!localDataset) return;

    setIsComparing(true);
    try {
      const fromEpoch = `${fromEpochMap(selectedEpoch)}_FMB_SURVEY`;
      const toEpoch = selectedEpoch === 2026 ? `2026_SATELLITE_DETECTED` : `${toEpochMap(targetEpoch)}_TSLR_DIGITAL`;

      const res = await fetch("/api/historical/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyNumber,
          fromEpoch,
          toEpoch,
        }),
      });
      const data = await res.json();
      if (data.comparison) {
        setComparisonResult({
          fromEpoch,
          toEpoch,
          ...data,
        });
      }
    } catch (e) {
      console.error("Comparison failed:", e);
    } finally {
      setIsComparing(false);
    }
  };

  const fromEpochMap = (year: number): string => {
    const map: Record<number, string> = {
      1967: "1967",
      1975: "1975",
      1985: "1985",
      2005: "2005",
      2018: "2018",
      2026: "2026",
    };
    return map[year] || `1967`;
  };

  const toEpochMap = (year: number): string => {
    const map: Record<number, string> = {
      1967: "1967",
      1975: "1985",
      1985: "1985",
      2005: "2005",
      2018: "2005",
      2026: "2026",
    };
    return map[year] || "2026";
  };

  const getEpochLabel = (year: number): string => {
    const epoch = epochs.find((e) => e.year === year);
    return epoch ? epoch.label : String(year);
  };

  const getEpochColor = (year: number): string => {
    const epoch = epochs.find((e) => e.year === year);
    return epoch ? epoch.color : "from-slate-500 to-slate-600";
  };

  const getEpochIcon = (year: number): React.ReactNode => {
    const epoch = epochs.find((e) => e.year === year);
    return epoch ? epoch.icon : <Calendar className="w-4 h-4" />;
  };

  const getDriftTypeColor = (driftType: string) => {
    switch (driftType) {
      case "EQUALLY_SKETCHED":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "BOUNDARY_DRIFT":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "ROAD_ENCROACHMENT":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "OSR_ENCROACHMENT":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1001] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Historical Timeline Browser</h2>
              <p className="text-xs text-slate-400">
                Multi-Temporal Boundary Congruence Analysis • Survey No. {surveyNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Rail */}
        <div className="px-6 py-5 border-b border-white/10 bg-slate-950/50">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute top-6 left-0 right-0 h-1 bg-slate-700" />

            {/* Epoch markers */}
            <div className="flex items-center justify-between">
              {epochs.map((epoch, idx) => (
                <div key={epoch.year} className="flex flex-col items-center">

                    <div
                      onClick={() => {
                        setSelectedEpoch(epoch.year);
                        if (epoch.year !== 2026) setTargetEpoch(epoch.year);
                      }}
                      className={`relative z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                        selectedEpoch === epoch.year || targetEpoch === epoch.year
                          ? "border-white bg-white text-slate-900 scale-110"
                          : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300"
                      }`}
                      title={epoch.label}
                    >
                      {getEpochIcon(epoch.year)}
                    </div>
                    <span
                      className={`mt-2 text-[10px] font-mono ${
                        selectedEpoch === epoch.year || targetEpoch === epoch.year
                          ? "text-white font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      {epoch.year}
                    </span>
                    <span className="text-[9px] text-slate-500 text-center max-w-16 mt-0.5">
                      {epoch.label.split(" ")[0]}
                    </span>
                </div>
              ))}
            </div>

            {/* Epoch range selector */}
            <div className="absolute -bottom-10 left-0 right-0 flex items-center justify-center gap-3">
              <span className="text-xs text-slate-400">From:</span>
              <select
                value={selectedEpoch}
                onChange={(e) => setSelectedEpoch(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              >
                {epochs.map((e) => (
                  <option key={`from-${e.year}`} value={e.year}>
                    {e.year} — {e.label}
                  </option>
                ))}
              </select>
              <ArrowIcon />
              <span className="text-xs text-slate-400">To:</span>
              <select
                value={targetEpoch}
                onChange={(e) => setTargetEpoch(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              >
                {epochs.map((e) => (
                  <option key={`to-${e.year}`} value={e.year}>
                    {e.year} — {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* G-Line & Ladder Stations */}
          {localDataset?.gLine && (
            <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-cyan-400" />
                G-Line Reference & Ladder Stations
              </h3>
              <div className="text-xs text-slate-400 mb-2">
                Baseline: {localDataset.gLine.lengthMeters}m • Azimuth: {localDataset.gLine.azimuthDeg}°
              </div>
              <div className="flex flex-wrap gap-2">
                {localDataset.gLine.ladderStations.map((station) => (
                  <div
                    key={station.chainage}
                    className="px-3 py-1.5 bg-slate-900/70 border border-slate-800 rounded-lg text-xs"
                  >
                    <span className="text-cyan-300 font-mono">{station.label}</span>
                    <span className="text-slate-500 ml-2">
                      Ch {station.chainage}m • {station.lat.toFixed(5)}°N, {station.lng.toFixed(5)}°E
                    </span>
                    {station.offsetLeftMeters !== undefined && (
                      <span className="text-slate-500 font-mono"> | L:{station.offsetLeftMeters}m</span>
                    )}
                    {station.offsetRightMeters !== undefined && (
                      <span className="text-slate-500 font-mono"> R:{station.offsetRightMeters}m</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Button */}
          <div className="mb-6 flex justify-center">
            <button
              onClick={handleCompareEpochs}
              disabled={isComparing || !localDataset}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Comparing Epochs...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  <span>Compare {getEpochLabel(selectedEpoch)} → {getEpochLabel(targetEpoch)}</span>
                </>
              )}
            </button>
          </div>

          {/* Comparison Results */}
          {comparisonResult && (
            <div className="mb-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Temporal Comparison: {fromEpochMap(selectedEpoch)} → {targetEpoch}
              </h3>

              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                <div className="grid grid-cols-4 gap-4 text-center text-xs mb-3">
                  <div>
                    <span className="text-slate-400 block">Total Plots</span>
                    <span className="font-bold text-white">{comparisonResult.summary?.totalPlots || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Congruent</span>
                    <span className="font-bold text-emerald-400">{comparisonResult.summary?.congruent || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">With Drift</span>
                    <span className="font-bold text-red-400">{comparisonResult.summary?.withDrift || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Max Displacement</span>
                    <span className="font-bold text-amber-400">{comparisonResult.summary?.maxDisplacementMeters || 0}m</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {(comparisonResult.comparison || []).map((item: any) => (
                  <div
                    key={item.plotId}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{item.plotNumber || item.plotId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getDriftTypeColor(item.driftType)}`}>
                          {item.driftType?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-slate-400">
                          Area Δ: {Math.abs(item.areaChangeSqMeters).toFixed(2)} m² ({item.areaChangePercent > 0 ? "+" : ""}{item.areaChangePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-500">Owner:</span>
                        <span className="text-slate-300 ml-1">{item.ownerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Max Shift:</span>
                        <span className={`ml-1 ${item.maxDisplacementMeters > 0.5 ? "text-red-400" : "text-emerald-400"}`}>
                          {item.maxDisplacementMeters.toFixed(2)}m
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">Audit:</span>
                        <span className="text-slate-300 ml-1">{item.auditRemark}</span>
                      </div>
                    </div>

                    {item.displacementVectors && item.displacementVectors.length > 0 && (
                      <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                          style={{
                            width: `${Math.min(100, (item.maxDisplacementMeters / 3) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Congruence Index Summary */}
          {localDataset && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Congruence Index Summary
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Overall Congruence Index</span>
                  <span className="text-sm font-bold text-white">{localDataset.congruenceIndexPercent}%</span>
                </div>

                <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-red-400 transition-all"
                    style={{ width: `${localDataset.congruenceIndexPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block">Equally Sketched</span>
                    <span className="font-bold text-emerald-400">{localDataset.equallySketchedCount}/{localDataset.totalPlots}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Minor Drift</span>
                    <span className="font-bold text-yellow-400">{localDataset.driftCount}/{localDataset.totalPlots}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Encroachment</span>
                    <span className="font-bold text-red-400">{localDataset.encroachmentCount}/{localDataset.totalPlots}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Temporal Changes List */}
          {temporalChanges.length > 0 && (
            <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Flagged Temporal Changes ({temporalChanges.length})
              </h3>
              <div className="space-y-2">
                {temporalChanges.map((change, idx) => (
                  <div key={idx} className="text-xs text-slate-300 p-2 bg-slate-900/30 rounded-lg">
                    <span className="font-mono text-sky-400">{change.uprn}</span>
                    {" — "}
                    <span className="text-slate-300">{change.ownerName}</span>
                    <span className="text-slate-500 ml-2">
                      ({change.fromYear} → {change.toYear}) • Δ:{change.areaChangeSqMeters?.toFixed(1)}m²
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/50 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 flex items-center gap-2">
            <Info className="w-3 h-3 text-cyan-400" />
            <span>
              Temporal analysis derived from FMB/Baseline (1967), TSLR (2005), Layout Plans (2018), and Satellite (2026).
              Requires Survey Officer verification under TN Survey Act 1923 Sec. 10(1).
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ArrowIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.227A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.709z"></path>
  </svg>
);
