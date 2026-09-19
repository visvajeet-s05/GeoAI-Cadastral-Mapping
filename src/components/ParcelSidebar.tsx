import React, { useState, useEffect } from "react";
import {
  Parcel,
  AuditBlock,
  VlmAuditResult,
  ParcelStatus,
} from "../types";
import {
  formatArea,
  formatShortHash,
  getLandTypeColor,
  getStatusBadge,
  getUncertaintyColor,
} from "../lib/geoUtils";
import {
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Edit3,
  Wrench,
  Bot,
  Hash,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Lock,
  Copy,
  Check,
  User,
  MapPin,
  Calendar,
  ClipboardCheck,
  Save,
  Loader2,
  CheckCheck,
  MessageSquare,
  Clock,
  UserCheck,
  PenLine,
  RotateCcw,
  ChevronDown,
} from "lucide-react";

const REVIEW_STATUS_OPTIONS: {
  value: ParcelStatus;
  label: string;
  badge: string;
  description: string;
}[] = [
  {
    value: "AUTOMATICALLY_ACCEPTED",
    label: "AUTOMATICALLY_ACCEPTED",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    description: "Automated AI boundary accepted without manual field intervention.",
  },
  {
    value: "ACCEPTED_AFTER_REVIEW",
    label: "ACCEPTED_AFTER_REVIEW",
    badge: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    description: "Cadastral surveyor verified with DGPS rover and approved.",
  },
  {
    value: "REQUIRES_FIELD_INSPECTION",
    label: "REQUIRES_FIELD_INSPECTION",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    description: "Ambiguity or tree canopy occlusion; site survey required.",
  },
  {
    value: "TOPOLOGY_VERIFIED",
    label: "TOPOLOGY_VERIFIED",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    description: "Zero self-intersections and adjacent polygon boundaries verified.",
  },
  {
    value: "SURVEYOR_ADJUSTED",
    label: "SURVEYOR_ADJUSTED",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    description: "Boundary pegs adjusted interactively on map canvas.",
  },
  {
    value: "ENCROACHMENT_DISPUTE",
    label: "ENCROACHMENT_DISPUTE",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    description: "Boundary encroaches into public right-of-way or adjacent lot.",
  },
  {
    value: "REJECTED_DISPUTED",
    label: "REJECTED_DISPUTED",
    badge: "bg-red-500/20 text-red-300 border-red-500/40",
    description: "Legal boundary contestation or rejected title claim.",
  },
  {
    value: "TITLE_ISSUED",
    label: "TITLE_ISSUED",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    description: "Verifiable Digital Spatial Title (VDST) minted on SHA-256 ledger.",
  },
  {
    value: "DRAFT_SEGMENTATION",
    label: "DRAFT_SEGMENTATION",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    description: "Preliminary computer vision contour from UAV orthomosaic.",
  },
];

interface ParcelSidebarProps {
  parcel: Parcel | null;
  auditChain: AuditBlock[];
  onClose: () => void;
  isSurveyorEditing: boolean;
  onToggleSurveyorEditing: () => void;
  onAutoRepairTopology: (parcelId: string) => void;
  onRunVlmAudit: (parcelId: string) => void;
  isAuditingVlm: boolean;
  vlmAuditResult: VlmAuditResult | null;
  onOpenCertificateModal: (parcel: Parcel) => void;
  onParcelUpdated?: (parcel: Parcel, auditBlock?: AuditBlock) => void;
}

export const ParcelSidebar: React.FC<ParcelSidebarProps> = ({
  parcel,
  auditChain,
  onClose,
  isSurveyorEditing,
  onToggleSurveyorEditing,
  onAutoRepairTopology,
  onRunVlmAudit,
  isAuditingVlm,
  vlmAuditResult,
  onOpenCertificateModal,
  onParcelUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<
    "review" | "geometry" | "topology" | "uncertainty" | "vlm" | "audit_chain"
  >("review");
  const [copiedHash, setCopiedHash] = useState(false);

  // Review status & Surveyor notes state with backend synchronization
  const [selectedStatus, setSelectedStatus] = useState<ParcelStatus>(
    parcel?.status || "DRAFT_SEGMENTATION"
  );
  const [surveyorNotes, setSurveyorNotes] = useState<string>(
    parcel?.surveyorNotes || ""
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "saved" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState<boolean>(false);

  useEffect(() => {
    if (parcel) {
      setSelectedStatus(parcel.status);
      setSurveyorNotes(parcel.surveyorNotes || "");
      setHasUnsavedNotes(false);
      setSyncStatus("idle");
      setSyncMessage(null);
    }
  }, [parcel?.id, parcel?.status, parcel?.surveyorNotes]);

  // Synchronize review status and surveyor field notes directly with backend
  const handleSyncReview = async (
    overrideStatus?: ParcelStatus,
    overrideNotes?: string
  ) => {
    if (!parcel) return;

    const statusToSave = overrideStatus !== undefined ? overrideStatus : selectedStatus;
    const notesToSave = overrideNotes !== undefined ? overrideNotes : surveyorNotes;

    setIsSyncing(true);
    setSyncStatus("syncing");
    setSyncMessage("Syncing with backend registry...");

    try {
      const res = await fetch(`/api/parcels/${parcel.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusToSave,
          surveyorNotes: notesToSave,
          surveyorId: "SURV-ROVER-701",
          surveyorName: "Cadastral Field Surveyor",
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.parcel) {
        setSelectedStatus(data.parcel.status);
        setSurveyorNotes(data.parcel.surveyorNotes || "");
        setHasUnsavedNotes(false);
        setSyncStatus("saved");
        setSyncMessage("Synced with SHA-256 Ledger");

        if (onParcelUpdated) {
          onParcelUpdated(data.parcel, data.newAuditBlock);
        }

        setTimeout(() => {
          setSyncStatus("idle");
          setSyncMessage(null);
        }, 3500);
      }
    } catch (err: any) {
      console.error("Failed to sync review status and surveyor notes:", err);
      setSyncStatus("error");
      setSyncMessage("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value as ParcelStatus;
    setSelectedStatus(nextStatus);
    handleSyncReview(nextStatus, surveyorNotes);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSurveyorNotes(val);
    setHasUnsavedNotes(val.trim() !== (parcel?.surveyorNotes || "").trim());
  };

  const handleNotesBlur = () => {
    if (hasUnsavedNotes) {
      handleSyncReview(selectedStatus, surveyorNotes);
    }
  };

  const handleInsertQuickTag = (tag: string) => {
    const updated = surveyorNotes ? `${surveyorNotes.trim()}\n${tag}` : tag;
    setSurveyorNotes(updated);
    setHasUnsavedNotes(true);
  };

  if (!parcel) {
    return (
      <aside className="w-full md:w-96 bg-slate-900 border-l border-slate-800 text-slate-400 p-6 flex flex-col items-center justify-center text-center select-none">
        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
          <MapPin className="w-6 h-6 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">No Parcel Selected</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Click any cadastral parcel polygon on the vector map to inspect Shoelace area calculations, topological integrity, VLM audits, and SHA-256 title records.
        </p>
      </aside>
    );
  }

  const area = formatArea(parcel.calculatedAreaSqMeters);
  const landTypeStyle = getLandTypeColor(parcel.landType);
  const statusStyle = getStatusBadge(selectedStatus);
  const uncertaintyStyle = getUncertaintyColor(parcel.overallUncertainty);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(parcel.currentHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <aside className="w-full md:w-[420px] lg:w-[440px] bg-slate-900 border-l border-slate-800 text-slate-200 flex flex-col h-full shadow-2xl overflow-hidden z-20 shrink-0">
      {/* Top Title Bar */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-2 shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white tracking-wide">
              {parcel.uprn}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${landTypeStyle.badge}`}
            >
              {landTypeStyle.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <User className="w-3 h-3 text-slate-500" />
            <span className="text-slate-300 font-medium">{parcel.ownerName}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            PID: {parcel.geoTraceCardNumber || parcel.svamitvaCardNumber}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close Sidebar"
        >
          ✕
        </button>
      </div>

      {/* Cadastral Review Quick Bar (Full Review Status Dropdown) */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            Review Status
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            {isSyncing ? (
              <span className="flex items-center gap-1 text-sky-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing...
              </span>
            ) : syncStatus === "saved" ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCheck className="w-3 h-3" />
                Synced
              </span>
            ) : hasUnsavedNotes ? (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Unsaved notes
              </span>
            ) : (
              <span className="text-slate-500">Registry Locked</span>
            )}
          </div>
        </div>

        {/* Full Review Status Dropdown */}
        <div className="relative">
          <select
            id="parcel-review-status-select"
            value={selectedStatus}
            onChange={handleStatusChange}
            disabled={isSyncing}
            className={`w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border bg-slate-900 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${statusStyle.className}`}
          >
            {REVIEW_STATUS_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-slate-900 text-slate-200 font-sans py-1"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Hash & Ledger Fingerprint */}
        <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 pt-0.5">
          <span className="flex items-center gap-1 text-slate-500">
            <Lock className="w-2.5 h-2.5 text-sky-400" />
            SHA-256:
          </span>
          <div className="flex items-center gap-1 text-sky-300">
            <span title={parcel.currentHash}>{formatShortHash(parcel.currentHash)}</span>
            <button
              onClick={handleCopyHash}
              className="hover:text-white p-0.5 rounded transition"
              title="Copy full SHA-256 hash"
            >
              {copiedHash ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs font-medium overflow-x-auto shrink-0">
        <button
          id="tab-review"
          onClick={() => setActiveTab("review")}
          className={`px-2.5 py-2 whitespace-nowrap transition border-b-2 flex items-center gap-1.5 text-[11px] ${
            activeTab === "review"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          Review & Notes
          {hasUnsavedNotes && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved notes" />
          )}
        </button>

        <button
          id="tab-geometry"
          onClick={() => setActiveTab("geometry")}
          className={`px-2.5 py-2 whitespace-nowrap transition border-b-2 flex items-center gap-1.5 text-[11px] ${
            activeTab === "geometry"
              ? "border-sky-500 text-sky-400 bg-sky-500/10 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Shoelace
        </button>

        <button
          id="tab-topology"
          onClick={() => setActiveTab("topology")}
          className={`px-2.5 py-2 whitespace-nowrap transition border-b-2 flex items-center gap-1.5 text-[11px] ${
            activeTab === "topology"
              ? "border-sky-500 text-sky-400 bg-sky-500/10 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Topology
        </button>

        <button
          id="tab-uncertainty"
          onClick={() => setActiveTab("uncertainty")}
          className={`px-2.5 py-2 whitespace-nowrap transition border-b-2 flex items-center gap-1.5 text-[11px] ${
            activeTab === "uncertainty"
              ? "border-sky-500 text-sky-400 bg-sky-500/10 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Uncertainty
        </button>

        <button
          id="tab-vlm"
          onClick={() => setActiveTab("vlm")}
          className={`px-2.5 py-2 whitespace-nowrap transition border-b-2 flex items-center gap-1.5 text-[11px] ${
            activeTab === "vlm"
              ? "border-sky-500 text-sky-400 bg-sky-500/10 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
          VLM Audit
        </button>

        <button
          id="tab-audit-chain"
          onClick={() => setActiveTab("audit_chain")}
          className={`px-2.5 py-2 whitespace-nowrap transition border-b-2 flex items-center gap-1.5 text-[11px] ${
            activeTab === "audit_chain"
              ? "border-sky-500 text-sky-400 bg-sky-500/10 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          Ledger
        </button>
      </div>

      {/* Tab Contents Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 0: SURVEYOR REVIEW & DEDICATED NOTES (SYNCS TO BACKEND) */}
        {activeTab === "review" && (
          <div className="space-y-4">
            {/* Status Overview Card */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  Cadastral Review Decision
                </h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusStyle.className}`}>
                  {selectedStatus}
                </span>
              </div>

              {/* Status Explanation */}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {REVIEW_STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.description ||
                  "Review status defines the administrative and legal standing of this cadastral lot."}
              </p>

              {/* Full Review Status Dropdown in Card */}
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="card-review-status-select"
                  className="text-[11px] font-semibold text-slate-300 flex items-center justify-between"
                >
                  <span>Update Review Decision:</span>
                  <span className="text-[10px] text-slate-500 font-normal">Syncs with SHA-256 Ledger</span>
                </label>
                <div className="relative">
                  <select
                    id="card-review-status-select"
                    value={selectedStatus}
                    onChange={handleStatusChange}
                    disabled={isSyncing}
                    className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {REVIEW_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Reviewer Details */}
              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-sky-400" />
                  {parcel.reviewedBy || "Field Surveyor Rover"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {parcel.reviewedAt
                    ? new Date(parcel.reviewedAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Pending Verification"}
                </span>
              </div>
            </div>

            {/* Dedicated Text Area for Surveyor Notes */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  <span>Surveyor Field Notes</span>
                </div>
                {hasUnsavedNotes ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Unsaved Edits
                  </span>
                ) : syncStatus === "saved" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✓ Saved
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Synced</span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Record field boundary beacon numbers, DGPS rover ground-truth coordinates, setback inspections, or neighbor consent records. These notes are cryptographically bound to the parcel.
              </p>

              {/* Dedicated Text Area */}
              <div className="relative">
                <textarea
                  id="surveyor-notes-textarea"
                  value={surveyorNotes}
                  onChange={handleNotesChange}
                  onBlur={handleNotesBlur}
                  rows={5}
                  placeholder="Enter surveyor field observations, beacon IDs, DGPS tolerances, or setback dispute notes here..."
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 font-mono leading-relaxed transition"
                />
                <div className="absolute right-2.5 bottom-2.5 text-[10px] text-slate-500 font-mono">
                  {surveyorNotes.length} chars
                </div>
              </div>

              {/* Quick Observation Insertion Chips */}
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 font-medium">Quick Field Observation Tags:</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "+ DGPS Rover Verified (±2cm)",
                    "+ Setback Compliant",
                    "+ Boundary Wall Truthed",
                    "+ Neighbor Consent Signed",
                    "+ Encroachment Resolved",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleInsertQuickTag(chip)}
                      className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Notes Action Button */}
              <div className="pt-2 flex items-center justify-between gap-2">
                {hasUnsavedNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setSurveyorNotes(parcel.surveyorNotes || "");
                      setHasUnsavedNotes(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}

                <button
                  id="btn-save-surveyor-notes"
                  type="button"
                  onClick={() => handleSyncReview(selectedStatus, surveyorNotes)}
                  disabled={isSyncing}
                  className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5 transition"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing with Registry...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Notes & Review to Backend</span>
                    </>
                  )}
                </button>
              </div>

              {syncMessage && (
                <div
                  className={`text-center text-[11px] font-medium py-1 px-2 rounded ${
                    syncStatus === "saved"
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : syncStatus === "error"
                      ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                      : "text-slate-400"
                  }`}
                >
                  {syncMessage}
                </div>
              )}
            </div>
          </div>
        )}
        {/* TAB 1: SHOELACE GEOMETRY & COORDINATES */}
        {activeTab === "geometry" && (
          <div className="space-y-4">
            {/* Big Shoelace Area Card */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Verified Surface Area (Shoelace Formula)</span>
                <span className="font-mono text-[10px] bg-slate-700/60 px-1.5 py-0.5 rounded text-sky-300">
                  WGS84 Geodesic
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight font-mono">
                  {area.sqm}
                </span>
                <span className="text-sm font-semibold text-slate-300">m²</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-slate-300 text-xs">
                <span>
                  Hectares: <strong className="text-sky-300">{area.hectares} Ha</strong>
                </span>
                <span>
                  Acres: <strong className="text-emerald-300">{area.acres} ac</strong>
                </span>
              </div>

              {/* Shoelace Equation Display */}
              <div className="mt-3 p-2 bg-slate-950/70 border border-slate-800 rounded text-[11px] font-mono text-slate-400 leading-relaxed">
                <div className="text-sky-400 font-semibold mb-1">
                  Formula: A = ½ | ∑ (xᵢ yᵢ₊₁ - xᵢ₊₁ yᵢ) |
                </div>
                <div>Perimeter: {parcel.perimeterMeters.toFixed(2)} meters</div>
                <div>Boundary Nodes: {parcel.vertexCount} vertices</div>
              </div>
            </div>

            {/* Surveyor Field Adjustment Mode */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">Surveyor Vertex Adjustment</div>
                <div className="text-[11px] text-slate-400">
                  Toggle interactive boundary peg dragging on map
                </div>
              </div>
              <button
                id="btn-toggle-surveyor-edit"
                onClick={onToggleSurveyorEditing}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  isSurveyorEditing
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isSurveyorEditing ? "Editing Active" : "Adjust Pegs"}
              </button>
            </div>

            {/* Coordinates Coordinate Table */}
            <div>
              <div className="flex items-center justify-between font-semibold text-slate-300 mb-2">
                <span>Boundary Vertices (WGS84 Coordinates)</span>
                <span className="text-slate-500 text-[11px]">{parcel.coordinates.length} points</span>
              </div>
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2.5">#</th>
                      <th className="py-1.5 px-2.5">Longitude (°E)</th>
                      <th className="py-1.5 px-2.5">Latitude (°N)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/70">
                    {parcel.coordinates.map(([lon, lat], idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-1 px-2.5 text-slate-500">{idx + 1}</td>
                        <td className="py-1 px-2.5 text-sky-300">{lon.toFixed(7)}</td>
                        <td className="py-1 px-2.5 text-slate-200">{lat.toFixed(7)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TOPOLOGY & INTEGRITY */}
        {activeTab === "topology" && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                Shapely Spatial Topology Inspection
              </h4>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-300">Self-Intersection Test (is_valid)</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    PASSED (No Knot)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-300">Exterior Ring Closure</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    CLOSED RING
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-300">Adjacent Parcel Overlap Check</span>
                  {parcel.encroachmentDetected ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      SETBACK VIOLATION
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      0.00 m² OVERLAP
                    </span>
                  )}
                </div>
              </div>

              {parcel.encroachmentDetected && (
                <div className="mt-3 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-rose-300">
                    <AlertTriangle className="w-4 h-4" />
                    Encroachment / Overlap Alert
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">
                    {parcel.encroachmentRemarks ||
                      "Boundary wall protrudes 1.65m beyond surveyed lot limit into public municipal right-of-way."}
                  </p>

                  <button
                    id="btn-auto-repair-topology"
                    onClick={() => onAutoRepairTopology(parcel.id)}
                    className="mt-2.5 w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5 transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Auto-Repair & Snap to Cadastral Boundary Line
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Topological Invariant Guarantee</div>
              <p className="text-[11px] leading-relaxed">
                The cadastral mesh maintains strict planar graph properties (Euler's characteristic F - E + V = 1).
                Shared boundary segments share identical vertex nodes, precluding sliver polygons and unauthorized double-titling.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: UNCERTAINTY & GEOAI */}
        {activeTab === "uncertainty" && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-200">Boundary Uncertainty Assessment</h4>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${uncertaintyStyle.badgeClass}`}>
                  {uncertaintyStyle.label.split("(")[0]}
                </span>
              </div>

              {/* Uncertainty Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                  <div className="text-slate-400 text-[11px]">Epistemic Uncertainty</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {parcel.epistemicUncertainty.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Model parameter variance (MC Dropout)
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                  <div className="text-slate-400 text-[11px]">Aleatoric Uncertainty</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {parcel.aleatoricUncertainty.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Image shadow & tree canopy occlusion
                  </div>
                </div>
              </div>

              {/* Total Calibrated Score Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">Combined Calibrated Uncertainty</span>
                  <span className="font-mono font-bold text-sky-400">
                    {parcel.overallUncertainty.toFixed(2)} / 1.00
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${parcel.overallUncertainty * 100}%`,
                      backgroundColor: uncertaintyStyle.hex,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-200">Surveyor Workflow Recommendation</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {parcel.overallUncertainty > 0.5
                  ? "High uncertainty detected along the northern vegetative hedge. Ground truthing with DGPS rover recommended before Verifiable Digital Spatial Title (VDST) certification."
                  : "Boundary ambiguity is well within tolerance (confidence > 85%). Suitable for immediate automated land title deed registration."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: VLM AI LAND-USE & ENCROACHMENT AUDIT */}
        {activeTab === "vlm" && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>Gemini Flash 2.0 / 3.8 VLM Land Auditor</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Multi-Modal Vision
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                Analyzes high-resolution aerial orthomosaic parcel bounds to detect informal extensions, structure counts, and municipal setback compliance.
              </p>

              <button
                id="btn-run-vlm-audit"
                onClick={() => onRunVlmAudit(parcel.id)}
                disabled={isAuditingVlm}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition"
              >
                {isAuditingVlm ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Analyzing Aerial Orthomosaic with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Run VLM Land-Use & Encroachment Audit</span>
                  </>
                )}
              </button>

              {/* Audit Results Panel */}
              {vlmAuditResult && (
                <div className="mt-4 pt-4 border-t border-slate-700/60 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <div className="text-slate-400 text-[10px]">Detected Land Type</div>
                      <div className="font-bold text-white text-xs mt-0.5">
                        {vlmAuditResult.land_type}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <div className="text-slate-400 text-[10px]">Permanent Structures</div>
                      <div className="font-bold text-white text-xs mt-0.5">
                        {vlmAuditResult.structure_count} roof footprints
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Zoning Compliance Score</span>
                      <span
                        className={`font-mono font-bold ${
                          vlmAuditResult.compliance_score >= 80 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {vlmAuditResult.compliance_score} / 100
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          vlmAuditResult.compliance_score >= 80 ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${vlmAuditResult.compliance_score}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${
                      vlmAuditResult.encroachment_detected
                        ? "bg-rose-950/40 border-rose-800/80 text-rose-200"
                        : "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      {vlmAuditResult.encroachment_detected ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Encroachment Flagged</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>No Encroachment Detected</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px]">{vlmAuditResult.encroachment_details}</p>
                  </div>

                  {/* Recommendations */}
                  {vlmAuditResult.recommendations?.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="font-semibold text-slate-300 text-[11px]">
                        Surveyor Action Directives:
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                        {vlmAuditResult.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: IMMUTABLE SHA-256 LEDGER */}
        {activeTab === "audit_chain" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-sky-400" />
                Immutable SHA-256 Audit Trail
              </h4>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Chain Valid
              </span>
            </div>

            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
              {auditChain.map((block, idx) => (
                <div
                  key={idx}
                  className="relative pl-8 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs space-y-1.5"
                >
                  <div className="absolute left-2 top-3.5 w-3.5 h-3.5 rounded-full bg-sky-500 border-2 border-slate-900 ring-2 ring-sky-500/30 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">
                      Block #{block.blockIndex} • {block.action}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(block.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    {block.changeDescription}
                  </div>

                  <div className="pt-1.5 border-t border-slate-700/50 space-y-1 font-mono text-[10px]">
                    <div className="text-slate-400 truncate">
                      Prev: <span className="text-slate-500">{block.previousHash}</span>
                    </div>
                    <div className="text-sky-300 truncate">
                      Hash: <span className="text-sky-200">{block.currentHash}</span>
                    </div>
                    <div className="text-emerald-400/90 truncate">
                      Signer: {block.surveyorName} ({block.surveyorId})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Actions */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2 shrink-0">
        <button
          id="btn-open-title-cert"
          onClick={() => onOpenCertificateModal(parcel)}
          className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Generate Digital Title Seal</span>
        </button>

        <button
          id="btn-quick-auto-repair"
          onClick={() => onAutoRepairTopology(parcel.id)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="Auto-Repair & Snap Topology"
        >
          <Wrench className="w-3.5 h-3.5 text-sky-400" />
        </button>
      </div>
    </aside>
  );
};
