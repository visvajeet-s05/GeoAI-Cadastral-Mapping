import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  X,
  Search,
  Filter,
  FileText,
  Image,
  File as FilePdf,
  Map,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Download,
  Trash2,
  Copy,
  BarChart3,
} from "lucide-react";
import type {
  DocumentMetadata,
  DocumentType,
  DocumentStatus,
  GovernmentSource,
} from "../types/documents";

interface DocumentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DocumentStoreResponse {
  status: string;
  count: number;
  documents: DocumentMetadata[];
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<DocumentType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | "ALL">("ALL");
  const [filterSource, setFilterSource] = useState<GovernmentSource | "ALL">("ALL");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    let result = documents;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.documentId.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q) ||
          d.originalName.toLowerCase().includes(q) ||
          d.documentReference?.toLowerCase().includes(q) ||
          d.district?.toLowerCase().includes(q) ||
          d.surveyNumber?.toLowerCase().includes(q)
      );
    }

    if (filterType !== "ALL") {
      result = result.filter((d) => d.documentType === filterType);
    }

    if (filterStatus !== "ALL") {
      result = result.filter((d) => d.status === filterStatus);
    }

    if (filterSource !== "ALL") {
      result = result.filter((d) => d.source === filterSource);
    }

    setFilteredDocs(result);
  }, [searchQuery, documents, filterType, filterStatus, filterSource]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data: DocumentStoreResponse = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryProcessing = async (docId: string) => {
    try {
      await fetch(`/api/documents/${docId}/retry-processing`, { method: "POST" });
      fetchDocuments();
    } catch (e) {
      console.error("Retry failed:", e);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.documentId !== docId));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const getFileIcon = (doc: DocumentMetadata) => {
    const ext = doc.fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FilePdf className="w-5 h-5 text-red-400" />;
    if (["jpg", "jpeg", "png", "tiff", "tif"].includes(ext || "")) return <Image className="w-5 h-5 text-cyan-400" />;
    if (["geojson", "json", "kml", "kmz"].includes(ext || "")) return <Map className="w-5 h-5 text-emerald-400" />;
    if (["csv"].includes(ext || "")) return <BarChart3 className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  const getStatusBadge = (status: DocumentStatus) => {
    const badges: Record<DocumentStatus, { color: string; icon: React.ReactNode }> = {
      UPLOADED: { color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: <Clock className="w-3 h-3" /> },
      PROCESSING: { color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: <Clock className="w-3 h-3 animate-spin" /> },
      OCR_EXTRACTED: { color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", icon: <FileText className="w-3 h-3" /> },
      GEOMETRY_EXTRACTED: { color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: <Map className="w-3 h-3" /> },
      GEOREFERENCED: { color: "bg-teal-500/20 text-teal-300 border-teal-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
      VALIDATED: { color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
      FAILED: { color: "bg-rose-500/20 text-rose-300 border-rose-500/30", icon: <AlertCircle className="w-3 h-3" /> },
      REQUIRES_REVIEW: { color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: <AlertCircle className="w-3 h-3" /> },
    };

    const badge = badges[status] || badges.UPLOADED;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 ${badge.color}`}>
        {badge.icon}
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const getFileTypeLabel = (doc: DocumentMetadata) => {
    const ext = doc.fileName.split(".").pop()?.toUpperCase();
    return ext || "FILE";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterType("ALL");
    setFilterStatus("ALL");
    setFilterSource("ALL");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1001] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Document Manager</h2>
              <p className="text-xs text-slate-400">
                {documents.filter((d) => d.status === "UPLOADED" || d.status === "PROCESSING").length} pending processing • {documents.filter((d) => d.status === "VALIDATED" || d.status === "GEOREFERENCED").length} completed
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

        {/* Search & Filters */}
        <div className="px-6 py-4 border-b border-white/10 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename, document ID, survey number, or district..."
              className="w-full bg-slate-800/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DocumentType | "ALL")}
              className="bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="ALL">All Types</option>
              <option value="FMB_SKETCH">FMB Sketch</option>
              <option value="TSLR">TSLR</option>
              <option value="PATTA">Patta</option>
              <option value="CHITTA">Chitta</option>
              <option value="A_REGISTER">A-Register</option>
              <option value="APPROVED_LAYOUT">Approved Layout</option>
              <option value="HISTORICAL_RECORD">Historical Record</option>
              <option value="UAV_ORTHOPHOTO">UAV Orthophoto</option>
              <option value="UAV_IMAGE">UAV Image</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as DocumentStatus | "ALL")}
              className="bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="UPLOADED">Uploaded</option>
              <option value="PROCESSING">Processing</option>
              <option value="OCR_EXTRACTED">OCR Extracted</option>
              <option value="GEOMETRY_EXTRACTED">Geometry Extracted</option>
              <option value="GEOREFERENCED">Georeferenced</option>
              <option value="VALIDATED">Validated</option>
              <option value="FAILED">Failed</option>
              <option value="REQUIRES_REVIEW">Requires Review</option>
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as GovernmentSource | "ALL")}
              className="bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="ALL">All Sources</option>
              <option value="TAMILNILAM">TamilNilam</option>
              <option value="TAMILNILAM_URBAN">TamilNilam Urban</option>
              <option value="CMDA">CMDA</option>
              <option value="DTCP">DTCP</option>
              <option value="TNREGINET">TNREGINET</option>
              <option value="USER_UPLOADED">User Uploaded</option>
            </select>

            {(searchQuery || filterType !== "ALL" || filterStatus !== "ALL" || filterSource !== "ALL") && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p>Loading documents...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents found</p>
              <p className="text-xs mt-1">
                {documents.length === 0
                  ? "Upload documents to see them here"
                  : "No documents match your filters"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.documentId}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">{getFileIcon(doc)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {doc.originalName}
                          </span>
                          <span className="text-[10px] bg-slate-700/50 text-slate-400 font-mono px-1.5 py-0.25 rounded">
                            {getFileTypeLabel(doc)}
                          </span>
                        </div>
                        {getStatusBadge(doc.status)}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                        <div className="flex flex-wrap gap-x-4">
                          <span>ID: {doc.documentId}</span>
                          <span>Type: {doc.documentType.replace(/_/g, " ")}</span>
                          <span>Size: {formatFileSize(doc.fileSize)}</span>
                          {doc.documentYear && <span>Year: {doc.documentYear}</span>}
                          {doc.surveyNumber && <span>S.No: {doc.surveyNumber}</span>}
                          {doc.district && <span>District: {doc.district}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => setExpandedDoc(expandedDoc === doc.documentId ? null : doc.documentId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                        title="View Details"
                      >
                        {expandedDoc === doc.documentId ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {expandedDoc === doc.documentId && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3 text-xs">
                      {/* Processing Steps */}
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold font-mono">
                          Processing Pipeline
                        </span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.processingSteps.map((step) => (
                            <span
                              key={step}
                              className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono text-[10px]"
                            >
                              {step}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Metadata Details */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold font-mono">
                            Administrative Context
                          </span>
                          <div className="mt-1 space-y-0.5 text-slate-300">
                            <div>District: {doc.district || "—"}</div>
                            <div>Taluk: {doc.taluk || "—"}</div>
                            <div>Village: {doc.village || "—"}</div>
                            <div>Survey No: {doc.surveyNumber || "—"}</div>
                            <div>Subdivision: {doc.subdivisionNumber || "—"}</div>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold font-mono">
                            Document Information
                          </span>
                          <div className="mt-1 space-y-0.5 text-slate-300">
                            <div>Reference: {doc.documentReference || "—"}</div>
                            <div>Source: {doc.source}</div>
                            <div>Coordinate System: {doc.coordinateSystem || "—"}</div>
                            <div>Scale: {doc.scale || "—"}</div>
                            <div>Orientation: {doc.orientation || "—"}</div>
                          </div>
                        </div>
                      </div>

                      {/* Georeferencing Details */}
                      {doc.georeferencing && (
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold font-mono">
                            Georeferencing
                          </span>
                          <div className="mt-1 text-slate-300 space-y-0.5">
                            <div>GCPs: {doc.georeferencing.gcpCount}</div>
                            <div>RMS Error: {doc.georeferencing.rmsErrorMeters.toFixed(3)} m</div>
                            <div>Max Residual: {doc.georeferencing.maxResidualMeters.toFixed(3)} m</div>
                            <div>Status: {doc.georeferencing.status}</div>
                          </div>
                        </div>
                      )}

                      {/* Extracted Data */}
                      {(doc.extractedText || doc.extractedSurveyNumber || doc.extractedDimensions) && (
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold font-mono">
                            Extracted Data
                          </span>
                          <div className="mt-1 text-slate-300 space-y-0.5">
                            {doc.extractedSurveyNumber && <div>Survey No (OCR): {doc.extractedSurveyNumber}</div>}
                            {doc.extractedDimensions && (
                              <div>Area: {doc.extractedDimensions.areaSqMeters?.toFixed(2)} m² | Perimeter: {doc.extractedDimensions.perimeterMeters?.toFixed(2)} m</div>
                            )}
                            {doc.extractedNeighbors && doc.extractedNeighbors.length > 0 && (
                              <div>Neighbors: {doc.extractedNeighbors.join(", ")}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Processing Errors */}
                      {doc.processingErrors && doc.processingErrors.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase text-rose-500 font-bold font-mono">
                            Processing Errors
                          </span>
                          <div className="mt-1 text-rose-300 space-y-0.5">
                            {doc.processingErrors.map((err, i) => (
                              <div key={i}>• {err}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Confidence & Quality */}
                      <div className="flex items-center gap-4 text-[10px]">
                        {doc.qualityScore !== undefined && (
                          <div>
                            <span className="text-slate-500">Quality:</span>
                            <span className="text-sky-300 font-mono">{(doc.qualityScore * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {doc.confidenceScore !== undefined && (
                          <div>
                            <span className="text-slate-500">Confidence:</span>
                            <span className="text-cyan-300 font-mono">{(doc.confidenceScore * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Verification:</span>
                          <span className="text-slate-300 font-mono">{doc.verificationStatus.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-1">
                        {doc.status === "FAILED" && (
                          <button
                            onClick={() => handleRetryProcessing(doc.documentId)}
                            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1"
                          >
                            Retry Processing
                          </button>
                        )}
                        {doc.status === "REQUIRES_REVIEW" && (
                          <button
                            className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] rounded-lg hover:bg-amber-500/30 transition"
                            title="Review and validate extracted data"
                          >
                            Review Required
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`/api/documents/${doc.documentId}/file`)}
                          className="px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition flex items-center gap-1"
                          title="Download original file"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.documentId)}
                          className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs text-rose-300 hover:bg-rose-500/30 transition flex items-center gap-1"
                          title="Delete document"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/50 flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            {documents.length} total documents
            {filteredDocs.length !== documents.length && (
              <span> • {filteredDocs.length} filtered</span>
            )}
          </div>
          <button
            onClick={() => {
              fetchDocuments();
              setExpandedDoc(null);
            }}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};
