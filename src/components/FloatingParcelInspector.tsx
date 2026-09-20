import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Award,
  ChevronRight,
  ChevronLeft,
  Layers,
  MapPin,
  CheckCircle2,
  SlidersHorizontal,
  Edit3,
  Scissors,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { Parcel, VlmAuditResult } from "../types";
import { getLandTypeColor, getUncertaintyColor } from "../lib/geoUtils";

interface FloatingParcelInspectorProps {
  parcel: Parcel | null;
  onClose: () => void;
  onOpenPropertyInspection?: (parcel: Parcel) => void;
  onOpenCertificateModal: () => void;
  onOpenReportModal: (parcel: Parcel) => void;
  onOpenVisualComparison: (parcel: Parcel) => void;
  onRunVlmAudit: (parcelId: string) => void;
  isAuditingVlm: boolean;
  vlmAuditResult: VlmAuditResult | null;
  onAutoRepairTopology: (parcelId: string) => void;
  isSurveyorEditing: boolean;
  onToggleSurveyorEditing: () => void;
  onSplitParcel?: (parcelId: string) => void;
  onUpdateParcelStatus?: (parcelId: string, status: any) => void;
}

export const FloatingParcelInspector: React.FC<FloatingParcelInspectorProps> = ({
  parcel,
  onClose,
  onOpenPropertyInspection,
  onOpenCertificateModal,
  onOpenReportModal,
  onOpenVisualComparison,
  onRunVlmAudit,
  isAuditingVlm,
  vlmAuditResult,
  onAutoRepairTopology,
  isSurveyorEditing,
  onToggleSurveyorEditing,
  onSplitParcel,
  onUpdateParcelStatus,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);

  // Keyboard shortcut (Ctrl+B / Cmd+B) to toggle inspector drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!parcel) return null;

  const legalArea = parcel.historicalAreaSqM || parcel.calculatedAreaSqMeters;
  const droneArea = parcel.calculatedAreaSqMeters;
  const areaDiff = Math.round((droneArea - legalArea) * 100) / 100;
  const hasDiscrepancy = parcel.encroachmentDetected || Math.abs(areaDiff) > 1.5;

  return (
    <div
      className={`fixed top-20 right-4 bottom-6 z-20 pointer-events-auto transition-transform duration-300 ease-out flex items-start ${
        isCollapsed ? "translate-x-[calc(100%-2.5rem)]" : "translate-x-0"
      }`}
    >
      {/* Collapse/Expand Toggle Tab */}
      <button
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="mt-4 -ml-4 w-8 h-10 bg-slate-900/95 border border-cyan-500/40 border-r-0 rounded-l-xl text-cyan-300 hover:text-white flex items-center justify-center shadow-2xl backdrop-blur-xl transition hover:bg-slate-800"
        title={isCollapsed ? "Expand Inspector (Ctrl+B)" : "Collapse Inspector (Ctrl+B)"}
      >
        {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Slim 340px Glass Blade Container */}
      <div className="w-[340px] h-full flex flex-col bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-slate-950/90 overflow-hidden text-slate-100">
        {/* 1. Header Toolbar */}
        <div className="px-3 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10"
              style={{ backgroundColor: getLandTypeColor(parcel.landType).fill }}
            />
            <div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-xs text-white">{parcel.uprn}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-cyan-300 border border-cyan-500/30 font-semibold">
                  S.No {parcel.surveyNumber || "142/2A"}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                PID: {parcel.geoTraceCardNumber || parcel.svamitvaCardNumber}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
          {/* Registered Owner Card */}
          <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[9px] uppercase text-slate-500 font-bold font-mono">Owner</div>
                <div className="font-bold text-xs text-white mt-0.5">{parcel.ownerName}</div>
                <div className="text-[9px] text-slate-400 font-mono">{parcel.ownerNationalId}</div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                  parcel.status === "TITLE_ISSUED"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : parcel.status === "ENCROACHMENT_DISPUTE"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                }`}
              >
                {parcel.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Area Metric Comparison Card */}
          <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
            <div className="text-[9px] uppercase text-slate-500 font-bold font-mono mb-1.5">
              Surface Area Metrics (m²)
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400 font-mono">Blueprint</div>
                <div className="text-xs font-bold text-sky-400 font-mono mt-0.5">
                  {Math.round(legalArea * 10) / 10} m²
                </div>
              </div>

              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400 font-mono">Drone Area</div>
                <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                  {Math.round(droneArea * 10) / 10} m²
                </div>
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono p-1.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
              <span className="text-slate-400">Variance (&Delta;A):</span>
              <span
                className={`font-bold ${
                  Math.abs(areaDiff) > 1.5 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {areaDiff > 0 ? `+${areaDiff}` : areaDiff} m²
              </span>
            </div>
          </div>

          {/* Encroachment Discrepancy Alert */}
          {hasDiscrepancy && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 flex flex-col gap-1 text-[11px] text-rose-200">
              <div className="flex items-center gap-1.5 font-bold text-rose-300 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Boundary Shift Flagged</span>
              </div>
              <p className="text-[10px] text-rose-300/80 font-mono leading-relaxed">
                {parcel.encroachmentRemarks || "Physical boundary shifts 1.45m into road setback."}
              </p>
            </div>
          )}

          {/* Under-Segmentation Warning & 1-Click Split Suggestion */}
          {parcel.structureCount > 1 && (
            <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-2.5 flex flex-col gap-1.5 text-xs text-amber-200 shadow-md">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Under-Segmentation Alert</span>
              </div>
              <p className="text-[10px] text-amber-200/90 font-mono leading-relaxed">
                Multiple ({parcel.structureCount}) independent house structures detected in this single polygon candidate.
              </p>
              <div className="flex gap-1.5 pt-0.5">
                <button
                  onClick={async () => {
                    if (onSplitParcel) {
                      setIsSplitting(true);
                      await onSplitParcel(parcel.id);
                      setIsSplitting(false);
                    }
                  }}
                  disabled={isSplitting}
                  className="flex-1 py-1 px-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center gap-1 shadow transition disabled:opacity-50"
                >
                  <Scissors className="w-3 h-3" />
                  <span>{isSplitting ? "Splitting..." : "Split Parcel Candidate"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Epistemic Score & Structures */}
          <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Compliance</div>
              <div className="text-xs font-bold text-white mt-0.5">{parcel.complianceScore}%</div>
            </div>

            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Confidence</div>
              <div
                className="text-xs font-bold mt-0.5"
                style={{ color: getUncertaintyColor(parcel.overallUncertainty).hex }}
              >
                {Math.round((1.0 - (parcel.overallUncertainty || 0.15)) * 100)}% ({parcel.overallUncertainty < 0.2 ? "HIGH" : parcel.overallUncertainty < 0.4 ? "MED" : "LOW"})
              </div>
            </div>

            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Structures</div>
              <div className="text-xs font-bold text-cyan-400 mt-0.5">
                {parcel.structureCount === 0 ? "Vacant Plot" : `${parcel.structureCount} Built`}
              </div>
            </div>
          </div>

          {/* Gemini VLM Land Audit Result */}
          {vlmAuditResult && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Gemini 2.0 VLM Land Audit</span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono">
                {vlmAuditResult.encroachment_details || "Verified compliant with municipal master layout."}
              </div>
            </div>
          )}

          {/* Human Verification Quick Actions */}
          <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800 space-y-1.5">
            <div className="text-[9px] uppercase text-slate-400 font-bold font-mono">
              Human Cadastral Verification
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => onUpdateParcelStatus?.(parcel.id, "ACCEPTED_AFTER_REVIEW")}
                className="py-1 px-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 font-bold text-[9px] flex items-center justify-center gap-0.5 transition"
                title="Approve Candidate Boundary"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => onUpdateParcelStatus?.(parcel.id, "ENCROACHMENT_DISPUTE")}
                className="py-1 px-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 font-bold text-[9px] flex items-center justify-center gap-0.5 transition"
                title="Flag Discrepancy / Reject"
              >
                <XCircle className="w-2.5 h-2.5" />
                <span>Dispute</span>
              </button>
              <button
                onClick={() => onUpdateParcelStatus?.(parcel.id, "REQUIRES_FIELD_INSPECTION")}
                className="py-1 px-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 font-bold text-[9px] flex items-center justify-center gap-0.5 transition"
                title="Mark for Ground DGPS Survey"
              >
                <HelpCircle className="w-2.5 h-2.5" />
                <span>Uncertain</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1.5 pt-1">
            {/* High-Resolution Single Property Inspection Window */}
            <button
              onClick={() => onOpenPropertyInspection?.(parcel)}
              className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/25 transition active:scale-98"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-200" />
              <span>Inspect Property (High-Res Crop)</span>
            </button>

            {/* Split Parcel Action */}
            <button
              onClick={async () => {
                if (onSplitParcel) {
                  setIsSplitting(true);
                  await onSplitParcel(parcel.id);
                  setIsSplitting(false);
                }
              }}
              disabled={isSplitting}
              className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-50"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{isSplitting ? "Splitting..." : "Split Parcel Polygon"}</span>
            </button>

            <button
              onClick={() => onRunVlmAudit(parcel.id)}
              disabled={isAuditingVlm}
              className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAuditingVlm ? "Analyzing..." : "Gemini VLM Audit"}</span>
            </button>

            <button
              onClick={onOpenCertificateModal}
              className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>Issue Title Certificate</span>
            </button>

            <button
              onClick={() => onOpenVisualComparison(parcel)}
              className="w-full py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400" />
              <span>1967 vs 2026 Comparison</span>
            </button>

            <button
              onClick={() => onOpenReportModal(parcel)}
              className="w-full py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>Statutory Spatial Audit</span>
            </button>

            <button
              onClick={onToggleSurveyorEditing}
              className={`w-full py-1.5 px-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border transition ${
                isSurveyorEditing
                  ? "bg-amber-500/25 text-amber-300 border-amber-500/60"
                  : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSurveyorEditing ? "Exit Edit Mode" : "Surveyor Vertex Edit"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
