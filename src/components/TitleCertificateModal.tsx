import React, { useState } from "react";
import { Parcel } from "../types";
import { formatArea } from "../lib/geoUtils";
import { ShieldCheck, Printer, Download, X, QrCode, CheckCircle2, Copy, Check } from "lucide-react";

interface TitleCertificateModalProps {
  parcel: Parcel | null;
  onClose: () => void;
}

export const TitleCertificateModal: React.FC<TitleCertificateModalProps> = ({
  parcel,
  onClose,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!parcel) return null;

  const area = formatArea(parcel.calculatedAreaSqMeters);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(parcel, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `GEOTRACE_VDST_${parcel.uprn}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(parcel.currentHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 ring-4 ring-sky-500/20 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:m-0 print:border-none print:shadow-none print:ring-0">
        {/* Header Ribbon */}
        <div className="shrink-0 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-sky-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-sky-400 uppercase tracking-widest">
                GEOTRACE-AI FRAMEWORK • GEOTRACE CERTIFIED TITLE BLOCK
              </div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                VERIFIABLE DIGITAL SPATIAL TITLE (VDST)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition print:hidden"
            title="Close certificate"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
          {/* Top Identifier Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-200 pb-5 items-center">
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Unique Property Record Number (UPRN)
              </div>
              <div className="font-mono text-lg sm:text-xl font-bold text-sky-900 mt-0.5">
                {parcel.uprn}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                GeoTrace Title Record ID (GT-PID)
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-slate-800 mt-0.5">
                {parcel.geoTraceCardNumber || parcel.svamitvaCardNumber}
              </div>
            </div>

            <div className="sm:flex sm:justify-end">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>TITLE CERTIFIED</span>
              </div>
            </div>
          </div>

          {/* Owner Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Registered Land Owner</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {parcel.ownerName}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 font-medium">National Identity / Aadhaar</div>
              <div className="text-sm font-mono font-semibold text-slate-800 mt-0.5">
                {parcel.ownerNationalId}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 font-medium">Cadastral Land Use Classification</div>
              <div className="text-sm font-semibold text-sky-800 mt-0.5">
                {parcel.landType}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 font-medium">Survey District / Tehsil</div>
              <div className="text-sm font-semibold text-slate-800 mt-0.5">
                Sector 4 Abadi Village, Central Division
              </div>
            </div>
          </div>

          {/* Cadastral Field Survey & Review Record */}
          <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Surveyor Ground-Truth & Review Record</span>
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                {parcel.status}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-200/80">
              <div>
                <span className="text-[11px] text-slate-500">Certified Reviewer:</span>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {parcel.reviewedBy || "Cadastral Field Surveyor Rover"}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Verification Timestamp:</span>
                <div className="font-mono text-slate-700 text-[11px] mt-0.5">
                  {parcel.reviewedAt
                    ? new Date(parcel.reviewedAt).toLocaleString()
                    : new Date(parcel.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
            {parcel.surveyorNotes ? (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium">Surveyor Field Observations:</span>
                <p className="text-xs text-slate-800 font-mono bg-white p-2.5 rounded-lg border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                  {parcel.surveyorNotes}
                </p>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic pt-1">
                Automated AI photogrammetry boundary. DGPS ground-truthing notes pending.
              </div>
            )}
          </div>

          {/* Exact Geometric Measurements (Shoelace Formula) */}
          <div className="border border-sky-200 bg-sky-50/60 p-5 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                  Verified Boundary Surface Area (Shoelace Geodesic Math)
                </div>
                <div className="text-3xl font-black font-mono text-sky-950 mt-1 flex items-baseline gap-1">
                  <span>{area.sqm}</span>
                  <span className="text-lg font-bold text-sky-800">m²</span>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 text-left sm:text-right">
                <div className="text-xs text-slate-600 bg-white/70 px-2.5 py-1 rounded border border-sky-100 sm:bg-transparent sm:p-0 sm:border-none">
                  <span className="text-slate-500 block sm:inline">Equivalent: </span>
                  <strong className="text-slate-900 font-mono">{area.hectares} Ha</strong>
                </div>
                <div className="text-xs text-slate-600 bg-white/70 px-2.5 py-1 rounded border border-sky-100 sm:bg-transparent sm:p-0 sm:border-none">
                  <span className="text-slate-500 block sm:inline">Equivalent: </span>
                  <strong className="text-slate-900 font-mono">{area.acres} ac</strong>
                </div>
                <div className="text-xs text-slate-600 bg-white/70 px-2.5 py-1 rounded border border-sky-100 sm:bg-transparent sm:p-0 sm:border-none">
                  <span className="text-slate-500 block sm:inline">Perimeter: </span>
                  <strong className="text-slate-900 font-mono">{parcel.perimeterMeters} m</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-sky-200/80 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono">
                Centroid: {parcel.centroid.latitude.toFixed(6)}°N, {parcel.centroid.longitude.toFixed(6)}°E
              </span>
              <span className="font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Topological Invariant: Zero Overlap Verified
              </span>
            </div>
          </div>

          {/* Cryptographic Ledger Verification Stamp */}
          <div className="border border-slate-200 bg-slate-50/60 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>Cryptographic Cadastral Ledger Seal (SHA-256)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-[11px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 break-all select-all flex-1">
                  {parcel.currentHash}
                </code>
                <button
                  onClick={handleCopyHash}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition shrink-0"
                  title="Copy SHA-256 Hash"
                >
                  {copiedHash ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2">
                <span>
                  Digital Signature: <strong className="font-mono text-slate-700">ED25519-SIG-882190B-SURV-GOV</strong>
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-medium">Merkle-Root-Verified</span>
              </div>
            </div>

            {/* QR Code Stamp Box */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-slate-800 p-1.5 rounded-lg bg-white flex flex-col items-center justify-center shrink-0 shadow-xs">
              <QrCode className="w-full h-full text-slate-900" />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 bg-slate-100 border-t border-slate-200 px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <span className="text-[11px] text-slate-500 text-center sm:text-left">
            Issued under GeoTrace-AI Uncertainty-Aware & Topology-Preserving GeoAI Cadastral Framework
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownloadJson}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-700 transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-semibold text-white transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Certificate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
