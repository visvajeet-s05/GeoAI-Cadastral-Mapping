import React, { useState, useEffect } from "react";
import {
  Parcel,
  AuditBlock,
  ActiveLayers,
  TopologyReport,
  VlmAuditResult,
  UAVTelemetry,
  IngestionMode,
  GovLayoutRecord,
  EncroachmentDiscrepancy,
  FmbPlanHistoricalDataset,
  PlotCongruenceRecord,
  DriftHotspot,
} from "./types";
import { Header } from "./components/Header";
import { TopMetricsBar } from "./components/TopMetricsBar";
import { DroneHUD } from "./components/DroneHUD";
import { MapView } from "./components/MapView";
import { ParcelSidebar } from "./components/ParcelSidebar";
import { TitleCertificateModal } from "./components/TitleCertificateModal";
import { DroneIngestionModal } from "./components/DroneIngestionModal";
import { SurveyFlightStreamModal } from "./components/SurveyFlightStreamModal";
import { CadastralSearchBar } from "./components/CadastralSearchBar";
import { HistoricalBlueprintModal } from "./components/HistoricalBlueprintModal";
import { ParcelAnalysisReportModal } from "./components/ParcelAnalysisReportModal";
import { VisualComparisonSlider } from "./components/VisualComparisonSlider";
import { LiveDroneSplitView, AIDetectionItem } from "./components/LiveDroneSplitView";
import { Sparkles, X, FileText, CheckCircle2 } from "lucide-react";

export default function App() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [auditChain, setAuditChain] = useState<AuditBlock[]>([]);
  const [topologyReport, setTopologyReport] = useState<TopologyReport | null>(null);
  const [isCheckingTopology, setIsCheckingTopology] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // Ingestion Mode & Virtual UAV Telemetry State
  const [ingestionMode, setIngestionMode] = useState<IngestionMode>("VIRTUAL_UAV");
  const [telemetry, setTelemetry] = useState<UAVTelemetry | null>(null);
  const [currentMapBounds, setCurrentMapBounds] = useState<[number, number, number, number] | null>(null);

  // Active Map Layer Toggles
  const [activeLayers, setActiveLayers] = useState<ActiveLayers>({
    vectorBoundaries: true,
    structuralFootprints: true,
    uncertaintyBands: false,
    zoningColors: true,
    topologyIssues: true,
    satelliteBasemap: true,
    legalGovLayout: true,
    discrepancyOverlay: true,
    gcpControlPoints: true,
  });

  // Historical FMB / FMDP Sketch Verification State
  const [historicalFmbDataset, setHistoricalFmbDataset] = useState<FmbPlanHistoricalDataset | null>(null);
  const [statutoryNoticeModal, setStatutoryNoticeModal] = useState<string | null>(null);

  // Surveyor Drag Editing Mode
  const [isSurveyorEditing, setIsSurveyorEditing] = useState<boolean>(false);

  // Layout View Visibility Toggles
  const [showMetricsBar, setShowMetricsBar] = useState<boolean>(true);
  const [showDroneHUD, setShowDroneHUD] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Live Drone Split View & AI Perception Detection State
  const [isDroneSplitOpen, setIsDroneSplitOpen] = useState<boolean>(true);
  const [selectedDetection, setSelectedDetection] = useState<AIDetectionItem | null>(null);

  // VLM Audit State
  const [isAuditingVlm, setIsAuditingVlm] = useState<boolean>(false);
  const [vlmAuditResult, setVlmAuditResult] = useState<VlmAuditResult | null>(null);

  // Modals
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showIngestionModal, setShowIngestionModal] = useState<boolean>(false);
  const [showStreamModal, setShowStreamModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState<boolean>(false);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);
  const [comparisonParcel, setComparisonParcel] = useState<Parcel | null>(null);
  const [streamConnected, setStreamConnected] = useState<boolean>(true);

  // Fetch Parcels on Mount
  useEffect(() => {
    fetchParcels();
    fetchTopologyReport();
  }, []);

  const fetchParcels = async () => {
    try {
      const res = await fetch("/api/parcels");
      const data = await res.json();
      if (data.parcels) {
        setParcels(data.parcels);
        if (!selectedParcel && data.parcels.length > 0) {
          selectParcel(data.parcels[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch parcels:", e);
    }
  };

  const fetchTopologyReport = async () => {
    setIsCheckingTopology(true);
    try {
      const res = await fetch("/api/topology/check", { method: "POST" });
      const data = await res.json();
      setTopologyReport(data);
    } catch (e) {
      console.error("Failed to run topology check:", e);
    } finally {
      setIsCheckingTopology(false);
    }
  };

  const selectParcel = async (parcel: Parcel) => {
    setSelectedParcel(parcel);
    setIsSidebarOpen(true);
    setIsSurveyorEditing(false);
    setVlmAuditResult(null);

    // Fetch audit chain for this parcel
    try {
      const res = await fetch(`/api/parcels/${parcel.id}`);
      const data = await res.json();
      if (data.auditChain) {
        setAuditChain(data.auditChain);
      }
    } catch (e) {
      console.error("Failed to fetch parcel audit chain:", e);
    }
  };

  const handleToggleLayer = (layer: keyof ActiveLayers) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Save surveyor adjusted boundary coordinates
  const handleSaveSurveyorAdjustment = async (updatedCoordinates: [number, number][]) => {
    if (!selectedParcel) return;
    try {
      const res = await fetch(`/api/parcels/${selectedParcel.id}/boundaries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: updatedCoordinates,
          surveyorId: "SURV-FIELD-01",
          surveyorName: "Surveyor Field Rover",
          justification: "Boundary peg positions verified with millimeter DGPS rover.",
        }),
      });
      const data = await res.json();
      if (data.parcel) {
        // Update parcel list
        setParcels((prev) =>
          prev.map((p) => (p.id === data.parcel.id ? data.parcel : p))
        );
        setSelectedParcel(data.parcel);
        if (data.newAuditBlock) {
          setAuditChain((prev) => [...prev, data.newAuditBlock]);
        }
        setIsSurveyorEditing(false);
      }
    } catch (e) {
      console.error("Failed to save surveyor adjustment:", e);
    }
  };

  // Auto-Repair Topology
  const handleAutoRepairTopology = async (parcelId: string) => {
    try {
      const res = await fetch(`/api/topology/repair/${parcelId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.parcel) {
        setParcels((prev) =>
          prev.map((p) => (p.id === data.parcel.id ? data.parcel : p))
        );
        setSelectedParcel(data.parcel);
        if (data.repairBlock) {
          setAuditChain((prev) => [...prev, data.repairBlock]);
        }
        // Refresh topology report
        fetchTopologyReport();
      }
    } catch (e) {
      console.error("Failed to auto-repair topology:", e);
    }
  };

  // Run VLM Land-Use & Encroachment Audit
  const handleRunVlmAudit = async (parcelId: string) => {
    if (!selectedParcel) return;
    setIsAuditingVlm(true);
    try {
      const res = await fetch("/api/vlm/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId,
          contextNotes: `Cadastral evaluation for lot ${selectedParcel.uprn}. Area: ${selectedParcel.calculatedAreaSqMeters} m².`,
        }),
      });
      const data = await res.json();
      if (data.audit) {
        setVlmAuditResult(data.audit);
      }
      if (data.updatedParcel) {
        setParcels((prev) =>
          prev.map((p) => (p.id === data.updatedParcel.id ? data.updatedParcel : p))
        );
        setSelectedParcel(data.updatedParcel);
      }
    } catch (e) {
      console.error("Failed to run VLM audit:", e);
    } finally {
      setIsAuditingVlm(false);
    }
  };

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    window.location.href = "/api/export/geojson";
  };

  // Ingest completed callback
  const handleIngestCompleted = (newParcels: Parcel[]) => {
    setParcels((prev) => [...newParcels, ...prev]);
    if (newParcels.length > 0) {
      selectParcel(newParcels[0]);
    }
    fetchTopologyReport();
  };

  // Trigger Demonstration Test Mode (Velachery, Chennai, Tamil Nadu)
  const handleTriggerTestMode = async () => {
    try {
      const res = await fetch("/api/spatial/test-mode", { method: "POST" });
      const data = await res.json();
      await fetchParcels();
      await fetchTopologyReport();
      setStatutoryNoticeModal(
        `PILOT DEMONSTRATION ACTIVATED:\n${data.message}\n\n` +
        `• State: Tamil Nadu\n` +
        `• District: ${data.activeDistrict}\n` +
        `• Taluk: ${data.activeTaluk}\n` +
        `• Village: ${data.activeVillage}\n` +
        `• Survey Number: S.No. ${data.surveyNumber}\n` +
        `• Parcels Synchronized: ${data.parcelsLoaded} cadastral plots\n` +
        `• AI Detections Active: ${data.aiDetectionsLoaded} perception records\n` +
        `• Historical FMB Blueprints: ${data.historicalPlansLoaded} records loaded\n\n` +
        `Statutory Reference: Tamil Nadu Survey and Boundaries Act 1923, Section 10(1) sub-division determination.`
      );
    } catch (e) {
      console.error("Test mode trigger failed:", e);
    }
  };

  const displayedParcels = selectedFilter
    ? parcels.filter((p) => p.status === selectedFilter)
    : parcels;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* 1. Header Toolbar & Layer Controls */}
      <Header
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        onOpenIngestModal={() => setShowIngestionModal(true)}
        onOpenStreamModal={() => setShowStreamModal(true)}
        onExportGeoJSON={handleExportGeoJSON}
        streamConnected={streamConnected}
        onRunNetworkTopologyCheck={fetchTopologyReport}
        isCheckingTopology={isCheckingTopology}
        showMetricsBar={showMetricsBar}
        onToggleMetricsBar={() => setShowMetricsBar((prev) => !prev)}
        showDroneHUD={showDroneHUD}
        onToggleDroneHUD={() => setShowDroneHUD((prev) => !prev)}
        onOpenBlueprintModal={() => setShowBlueprintModal(true)}
        onOpenVisualComparison={() => {
          setComparisonParcel(selectedParcel || parcels[0] || null);
          setShowComparisonModal(true);
        }}
        onTriggerTestMode={handleTriggerTestMode}
        isDroneSplitOpen={isDroneSplitOpen}
        onToggleDroneSplit={() => setIsDroneSplitOpen((prev) => !prev)}
      />

      {/* 2. Cadastral Spatial Key Metrics Bar */}
      {showMetricsBar && (
        <TopMetricsBar
          parcels={parcels}
          topologyReport={topologyReport}
          onFilterByStatus={(status) => setSelectedFilter(status)}
          selectedFilter={selectedFilter}
        />
      )}

      {/* 2.5. Live UAV Telemetry HUD & Ingestion Mode Switcher */}
      {showDroneHUD && (
        <DroneHUD
          telemetry={telemetry}
          onTelemetryUpdate={setTelemetry}
          ingestionMode={ingestionMode}
          onSelectIngestionMode={setIngestionMode}
          onOpenUploadModal={() => setShowIngestionModal(true)}
          onParcelsIngested={handleIngestCompleted}
          currentMapBounds={currentMapBounds}
        />
      )}

      {/* 3. Main Workspace: Map Canvas + Live Drone Split View + Cadastral Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* World A: Live Drone Perception & Sensor Video Stream (Left Viewport) */}
        {isDroneSplitOpen && (
          <div className="w-full md:w-1/2 lg:w-[48%] h-64 md:h-full shrink-0 border-b md:border-b-0 md:border-r border-slate-800 z-10">
            <LiveDroneSplitView
              telemetry={telemetry}
              selectedParcel={selectedParcel}
              onSelectParcel={(p) => {
                selectParcel(p);
                setIsSidebarOpen(true);
              }}
              parcels={parcels}
              selectedDetection={selectedDetection}
              onSelectDetection={(det) => {
                setSelectedDetection(det);
                if (det?.linkedParcelId) {
                  const linked = parcels.find((p) => p.id === det.linkedParcelId);
                  if (linked) {
                    selectParcel(linked);
                    setIsSidebarOpen(true);
                  }
                }
              }}
              isSplitScreen={isDroneSplitOpen}
              onToggleSplitScreen={() => setIsDroneSplitOpen(false)}
              onClose={() => setIsDroneSplitOpen(false)}
            />
          </div>
        )}

        {/* World B: Survey GIS Interactive Cadastral Map (Right Viewport) */}
        <div className="flex-1 relative h-full min-w-0">
          {/* Top Floating Search Bar */}
          <div className="absolute top-3 left-3 z-[400] max-w-sm sm:max-w-md w-full">
            <CadastralSearchBar
              parcels={parcels}
              onSelectParcel={selectParcel}
              selectedParcelId={selectedParcel?.id}
            />
          </div>

          <MapView
            parcels={displayedParcels}
            selectedParcel={selectedParcel}
            onSelectParcel={selectParcel}
            activeLayers={activeLayers}
            topologyReport={topologyReport}
            isSurveyorEditing={isSurveyorEditing}
            onSaveSurveyorAdjustment={handleSaveSurveyorAdjustment}
            onCancelSurveyorAdjustment={() => setIsSurveyorEditing(false)}
            telemetry={telemetry}
            ingestionMode={ingestionMode}
            onMapBoundsChange={setCurrentMapBounds}
            selectedDetection={selectedDetection}
            onSelectDetection={setSelectedDetection}
          />

          {/* Floating button to reopen sidebar if parcel selected but sidebar closed */}
          {!isSidebarOpen && selectedParcel && (
            <div className="absolute top-16 left-3 z-[450] flex items-center gap-2 bg-slate-900/95 border border-sky-500/60 text-white px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="font-bold text-sky-300">{selectedParcel.uprn}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({Math.round(selectedParcel.calculatedAreaSqMeters)}m²)
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="ml-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition"
                title="Open Parcel Cadastral Record"
              >
                Inspect
              </button>
            </div>
          )}
        </div>

        {/* Cadastral Detail Sidebar */}
        {isSidebarOpen && (
          <ParcelSidebar
            parcel={selectedParcel}
            auditChain={auditChain}
            onClose={() => setIsSidebarOpen(false)}
            isSurveyorEditing={isSurveyorEditing}
            onToggleSurveyorEditing={() => setIsSurveyorEditing((prev) => !prev)}
            onAutoRepairTopology={handleAutoRepairTopology}
            onRunVlmAudit={handleRunVlmAudit}
            isAuditingVlm={isAuditingVlm}
            vlmAuditResult={vlmAuditResult}
            onOpenCertificateModal={() => setShowCertificateModal(true)}
            onOpenReportModal={(p) => {
              setSelectedParcel(p);
              setShowReportModal(true);
            }}
            onOpenVisualComparison={(p) => {
              setComparisonParcel(p);
              setShowComparisonModal(true);
            }}
            onOpenBlueprintModal={() => setShowBlueprintModal(true)}
            onParcelUpdated={(updatedParcel, auditBlock) => {
              setParcels((prev) =>
                prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p))
              );
              setSelectedParcel(updatedParcel);
              if (auditBlock) {
                setAuditChain((prev) => [...prev, auditBlock]);
              }
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showCertificateModal && (
        <TitleCertificateModal
          parcel={selectedParcel}
          onClose={() => setShowCertificateModal(false)}
        />
      )}

      {showIngestionModal && (
        <DroneIngestionModal
          onClose={() => setShowIngestionModal(false)}
          onIngestCompleted={handleIngestCompleted}
        />
      )}

      {showStreamModal && (
        <SurveyFlightStreamModal onClose={() => setShowStreamModal(false)} />
      )}

      {/* Historical Blueprint & Ingestion Modal */}
      {showBlueprintModal && (
        <HistoricalBlueprintModal
          onClose={() => setShowBlueprintModal(false)}
          onBlueprintIngested={() => {
            fetchParcels();
            fetchTopologyReport();
          }}
        />
      )}

      {/* Parcel Spatial Analysis & Statutory Audit Report Modal */}
      {showReportModal && selectedParcel && (
        <ParcelAnalysisReportModal
          parcel={selectedParcel}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Multi-Temporal Visual Comparison Slider Modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 z-[650] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                <h3 className="font-bold text-sm text-white">
                  Multi-Temporal Visual Inspection (1967 FMB Sketch vs 2026 Drone Orthomosaic)
                </h3>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <VisualComparisonSlider
                parcel={comparisonParcel || selectedParcel || parcels[0]}
                fmbDataset={historicalFmbDataset}
              />
            </div>
          </div>
        </div>
      )}

      {/* Statutory Audit Summary Notice Modal (Generated via Gemini VLM) */}
      {statutoryNoticeModal && (
        <div className="fixed inset-0 z-[650] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Statutory Cadastral Audit Notice
                  </h3>
                  <p className="text-xs text-slate-400">
                    Multi-Temporal Boundary Congruence (1967 — 2026)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStatutoryNoticeModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 whitespace-pre-line leading-relaxed mb-4">
              {statutoryNoticeModal}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>All 8 plots verified against 1967 FMB, 1985 Layout, 2005 TSLR & 2026 Satellite.</span>
              </span>
              <button
                onClick={() => setStatutoryNoticeModal(null)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition"
              >
                Acknowledge & View on Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
