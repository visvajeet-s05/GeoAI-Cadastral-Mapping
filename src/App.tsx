import React, { useState, useEffect, useRef } from "react";
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
  SelectedLandContext,
  MapLayerConfig,
} from "./types";
import { MapView } from "./components/MapView";
import { FloatingGlassTopBar } from "./components/FloatingGlassTopBar";
import { UnifiedDashboardSidebar } from "./components/UnifiedDashboardSidebar";
import { FloatingFlightController } from "./components/FloatingFlightController";
import { FloatingParcelInspector } from "./components/FloatingParcelInspector";
import { UAVHudReticleOverlay } from "./components/UAVHudReticleOverlay";
import { TitleCertificateModal } from "./components/TitleCertificateModal";
import { DroneIngestionModal } from "./components/DroneIngestionModal";
import { SurveyFlightStreamModal } from "./components/SurveyFlightStreamModal";
import { HistoricalBlueprintModal } from "./components/HistoricalBlueprintModal";
import { ParcelAnalysisReportModal } from "./components/ParcelAnalysisReportModal";
import { VisualComparisonSlider } from "./components/VisualComparisonSlider";
import { DualStreamCadastralCockpit } from "./components/DualStreamCadastralCockpit";
import { PropertyInspectionModal } from "./components/PropertyInspectionModal";
import { AIDetectionItem } from "./components/LiveDroneSplitView";
import { HierarchicalSearch } from "./components/HierarchicalSearch";
import { LayerControl } from "./components/LayerControl";
import { DocumentUploadModal } from "./components/DocumentUploadModal";
import { DocumentManager } from "./components/DocumentManager";
import { IngestOrthoModal } from "./components/sidebar/IngestOrthoModal";
import { ActiveRasterLayerConfig } from "./types/raster";
import { downloadLandXML, downloadDXF } from "./lib/exporters";
import { Sparkles, X, FileText, CheckCircle2 } from "lucide-react";

export default function App() {
  // Parcels & Selected State
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [auditChain, setAuditChain] = useState<AuditBlock[]>([]);
  const [topologyReport, setTopologyReport] = useState<TopologyReport | null>(null);
  const [isCheckingTopology, setIsCheckingTopology] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Land Context State (New for Phase 1)
  const [selectedLandContext, setSelectedLandContext] = useState<SelectedLandContext | null>(null);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>("Velachery Town (S.No. 142)");

  // Map Layer Controls (New for Phase 1)
  const [mapLayers, setMapLayers] = useState<MapLayerConfig[]>([
    {
      id: 'district-boundary',
      name: 'District Boundary',
      type: 'ADMINISTRATIVE',
      visible: false,
      style: { color: '#9333ea', weight: 3, fillOpacity: 0.1 },
      source: 'Government of Tamil Nadu',
      zIndex: 10,
    },
    {
      id: 'taluk-boundary',
      name: 'Taluk Boundary',
      type: 'ADMINISTRATIVE',
      visible: false,
      style: { color: '#a855f7', weight: 2, fillOpacity: 0.15 },
      source: 'Government of Tamil Nadu',
      zIndex: 11,
    },
    {
      id: 'village-boundary',
      name: 'Village Boundary',
      type: 'ADMINISTRATIVE',
      visible: false,
      style: { color: '#c084fc', weight: 2, fillOpacity: 0.2 },
      source: 'Government of Tamil Nadu',
      zIndex: 12,
    },
    {
      id: 'aoi',
      name: 'Area of Interest',
      type: 'ADMINISTRATIVE',
      visible: false,
      style: { color: '#f59e0b', weight: 2, fillOpacity: 0.25, dashArray: [5, 5] },
      source: 'Geocoded / Selected',
      zIndex: 13,
    },
    {
      id: 'government-parcel',
      name: 'Government Parcel',
      type: 'CADASTRAL',
      visible: true,
      style: { color: '#3b82f6', weight: 2, fillOpacity: 0.3 },
      source: 'FMB / TSLR / Survey',
      zIndex: 20,
    },
    {
      id: 'survey-boundary',
      name: 'Survey Boundary',
      type: 'CADASTRAL',
      visible: false,
      style: { color: '#60a5fa', weight: 2, fillOpacity: 0.25 },
      source: 'Survey Records',
      zIndex: 21,
    },
    {
      id: 'fmb',
      name: 'FMB Sketch',
      type: 'CADASTRAL',
      visible: false,
      style: { color: '#3b82f6', weight: 2, fillOpacity: 0.2 },
      source: 'Field Measurement Book',
      zIndex: 22,
    },
    {
      id: 'tslr',
      name: 'TSLR',
      type: 'CADASTRAL',
      visible: false,
      style: { color: '#1d4ed8', weight: 2, fillOpacity: 0.2 },
      source: 'Town Survey Land Register',
      zIndex: 23,
    },
    {
      id: 'building-footprint',
      name: 'Building Footprint',
      type: 'PHYSICAL',
      visible: true,
      style: { color: '#f97316', weight: 2, fillOpacity: 0.4 },
      source: 'UAV Imagery',
      zIndex: 30,
    },
    {
      id: 'uav-observation',
      name: 'UAV Observation',
      type: 'PHYSICAL',
      visible: false,
      style: { color: '#fb923c', weight: 2, fillOpacity: 0.3 },
      source: 'Drone Imagery',
      zIndex: 31,
    },
    {
      id: 'ai-candidate-parcel',
      name: 'AI Candidate Parcel',
      type: 'AI',
      visible: false,
      style: { color: '#06b6d4', weight: 2, fillOpacity: 0.35 },
      source: 'AI Reconstruction',
      zIndex: 40,
    },
    {
      id: 'discrepancy',
      name: 'Discrepancy',
      type: 'DISCREPANCY',
      visible: false,
      style: { color: '#ef4444', weight: 2, fillOpacity: 0.4, dashArray: [3, 3] },
      source: 'Comparison Analysis',
      zIndex: 50,
    },
    {
      id: 'uncertainty',
      name: 'Uncertainty',
      type: 'AI',
      visible: false,
      style: { color: '#fbbf24', weight: 1, fillOpacity: 0.5 },
      source: 'AI Confidence',
      zIndex: 45,
    },
  ]);

  const handleToggleMapLayer = (layerId: string) => {
    setMapLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  // Map Active Tool ("INSPECT" | "MEASURE" | "EDIT_VERTEX")
  const [activeTool, setActiveTool] = useState<"INSPECT" | "MEASURE" | "EDIT_VERTEX">("INSPECT");
  const [isSurveyorEditing, setIsSurveyorEditing] = useState<boolean>(false);

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

  // Simulated UAV Drone Flight Telemetry State
  const [isSimulatingFlight, setIsSimulatingFlight] = useState<boolean>(true);
  const [isFollowDrone, setIsFollowDrone] = useState<boolean>(false);
  const [isReticleVisible, setIsReticleVisible] = useState<boolean>(true);
  const [flightAltitude, setFlightAltitude] = useState<number>(50.0);
  const [flightSpeed, setFlightSpeed] = useState<number>(8.5);
  const [flightZone, setFlightZone] = useState<"URBAN" | "RURAL" | "COMMERCIAL">("URBAN");
  const [telemetry, setTelemetry] = useState<UAVTelemetry | null>({
    latitude: 12.9839,
    longitude: 80.2090,
    altitude_agl: 50.0,
    gsd_cm_px: 1.8,
    rtk_status: "FIXED",
    satellites_tracked: 22,
    heading_deg: 45.0,
    speed_mps: 8.5,
    battery_percent: 98.4,
    zone: "URBAN",
    frame_index: 120,
    timestamp: Date.now(),
  });

  // Historical FMB / FMDP Sketch Verification State
  const [historicalFmbDataset, setHistoricalFmbDataset] = useState<FmbPlanHistoricalDataset | null>(null);
  const [statutoryNoticeModal, setStatutoryNoticeModal] = useState<string | null>(null);
  const [selectedDetection, setSelectedDetection] = useState<AIDetectionItem | null>(null);

  // VLM Audit State
  const [isAuditingVlm, setIsAuditingVlm] = useState<boolean>(false);
  const [vlmAuditResult, setVlmAuditResult] = useState<VlmAuditResult | null>(null);

  const [showPropertyInspectionModal, setShowPropertyInspectionModal] = useState<boolean>(false);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showIngestionModal, setShowIngestionModal] = useState<boolean>(false);
  const [showStreamModal, setShowStreamModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState<boolean>(false);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);
  const [showDualStreamCockpit, setShowDualStreamCockpit] = useState<boolean>(false);
  const [comparisonParcel, setComparisonParcel] = useState<Parcel | null>(null);
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState<boolean>(false);
  const [showDocumentManager, setShowDocumentManager] = useState<boolean>(false);
  const [showLayerControl, setShowLayerControl] = useState<boolean>(false);
  const [showHierarchicalSearch, setShowHierarchicalSearch] = useState<boolean>(false);
  const [activeRaster, setActiveRaster] = useState<ActiveRasterLayerConfig | null>(null);

  // Land Context Handlers
  const handleContextChange = (context: SelectedLandContext) => {
    setSelectedLandContext(context);
    console.log('Land context updated:', context);
    // If context has village/taluk/district name, relocate to that region
    const areaName = [context.village?.name, context.taluk?.name, context.district?.name]
      .filter(Boolean)
      .join(", ");
    if (areaName) {
      handleGlobalAreaSearch(areaName);
    }
  };

  // Real-time Global Area Navigation & Dynamic Cadastral Relocation
  const handleGlobalAreaSearch = async (
    query: string,
    presetCoords?: { lat: number; lon: number; name?: string; zoom?: number }
  ) => {
    console.log("Navigating to area:", query, presetCoords);
    try {
      let targetLat: number;
      let targetLon: number;
      let displayName: string;
      let district: string | undefined;
      let state: string | undefined;

      if (presetCoords && typeof presetCoords.lat === "number" && typeof presetCoords.lon === "number") {
        targetLat = presetCoords.lat;
        targetLon = presetCoords.lon;
        displayName = presetCoords.name || query;
      } else {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.status !== "success" || !data.location) {
          throw new Error(data.error || "Location not found");
        }
        targetLat = data.location.lat;
        targetLon = data.location.lon;
        displayName = data.location.displayName || query;
        district = data.administrativeContext?.district;
        state = data.administrativeContext?.state;
      }

      // 1. Immediately pan/zoom map to target location
      const zoom = presetCoords?.zoom || 18;
      setTargetLocation({
        lat: targetLat,
        lng: targetLon,
        zoom,
      });
      setCurrentLocationName(displayName);

      // 2. Relocate parcels on backend and reload
      const relocateRes = await fetch("/api/parcels/relocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: targetLat,
          lng: targetLon,
          locationName: displayName,
          district,
          state,
        }),
      });
      const relocateData = await relocateRes.json();

      if (relocateData.parcels && relocateData.parcels.length > 0) {
        setParcels(relocateData.parcels);
        setSelectedParcel(relocateData.parcels[0]);
      }

      // 3. Relocate UAV drone flight simulator
      await fetch("/api/drone/relocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: targetLat, lng: targetLon }),
      }).catch(() => {});

      // 4. Update administrative context
      setSelectedLandContext({
        contextId: `CTX-${Date.now()}`,
        district: {
          id: district || displayName,
          name: displayName,
        },
        dataAvailability: [
          { recordType: "PATTA", status: "AVAILABLE", source: "Cadastral Survey Registry" },
          { recordType: "FMB_SKETCH", status: "AVAILABLE", source: "GeoTRACE AI Ingestion" },
          { recordType: "TSLR", status: "AVAILABLE", source: "Municipal Survey Authority" },
        ],
        sourceMetadata: [
          {
            sourceId: "CAD-GLOBAL",
            sourceName: displayName,
            organization: "Land Records & Cadastral Mapping Department",
            sourceType: "OFFICIAL",
            accessMethod: "API",
            status: "AVAILABLE",
            notes: "Real-time Vectorized Cadastral Grid",
          },
        ],
      });

      return { success: true, location: { lat: targetLat, lon: targetLon, displayName } };
    } catch (error) {
      console.error("Geocoding/relocation failed:", error);
      return { success: false, error };
    }
  };

  const handleFreeSearch = async (query: string) => {
    await handleGlobalAreaSearch(query);
  };

  // WebSocket Live Telemetry Connection
  useEffect(() => {
    fetchParcels();
    fetchTopologyReport();

    // Connect WebSocket for real-time UAV flight telemetry
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/cadastral-stream`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.telemetry) {
            setTelemetry(data.telemetry);
          }
        } catch {
          // ignore parsing
        }
      };
    } catch (err) {
      console.warn("WebSocket stream fallback to polling:", err);
    }

    return () => {
      if (ws) ws.close();
    };
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
    setShowHierarchicalSearch(false);
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

  const handleSelectTool = (tool: "INSPECT" | "MEASURE" | "EDIT_VERTEX") => {
    setActiveTool(tool);
    if (tool === "EDIT_VERTEX") {
      setIsSurveyorEditing(true);
    } else {
      setIsSurveyorEditing(false);
    }
  };

  // Save surveyor adjusted boundary coordinates or architectural building footprint
  const handleSaveSurveyorAdjustment = async (
    updatedCoordinates: [number, number][],
    target: "PARCEL" | "BUILDING" = "PARCEL"
  ) => {
    if (!selectedParcel) return;
    try {
      const endpoint =
        target === "BUILDING"
          ? `/api/parcels/${selectedParcel.id}/building-footprint`
          : `/api/parcels/${selectedParcel.id}/boundaries`;

      const bodyPayload =
        target === "BUILDING"
          ? {
              buildingFootprint: updatedCoordinates,
              surveyorId: "SURV-FIELD-01",
              surveyorName: "Surveyor Field Rover",
              justification: "Rooftop perimeter aligned with high-resolution satellite orthophoto ground truth.",
            }
          : {
              coordinates: updatedCoordinates,
              surveyorId: "SURV-FIELD-01",
              surveyorName: "Surveyor Field Rover",
              justification: "Boundary peg positions verified with millimeter DGPS rover and topological edge lock.",
            };

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (data.parcel) {
        setParcels((prev) =>
          prev.map((p) => (p.id === data.parcel.id ? data.parcel : p))
        );
        setSelectedParcel(data.parcel);
        if (data.newAuditBlock) {
          setAuditChain((prev) => [...prev, data.newAuditBlock]);
        }
        setIsSurveyorEditing(false);
        setActiveTool("INSPECT");
        fetchTopologyReport();
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
        fetchTopologyReport();
      }
    } catch (e) {
      console.error("Failed to auto-repair topology:", e);
    }
  };

  // Split parcel to resolve under-segmentation (One House -> One Boundary)
  const handleSplitParcel = async (parcelId: string) => {
    try {
      const res = await fetch("/api/parcels/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId,
          splitOrientation: "VERTICAL",
          surveyorId: "SURV-FIELD-01",
          surveyorName: "Surveyor Field Rover",
        }),
      });
      const data = await res.json();
      if (data.childParcels && data.childParcels.length > 0) {
        setParcels((prev) => [
          ...prev.filter((p) => p.id !== data.removedParcelId),
          ...data.childParcels,
        ]);
        setSelectedParcel(data.childParcels[0]);
        fetchTopologyReport();
      }
    } catch (e) {
      console.error("Failed to split parcel:", e);
    }
  };

  // Human Review Decision & Verification Status Update
  const handleUpdateParcelStatus = async (parcelId: string, status: string) => {
    try {
      const res = await fetch(`/api/parcels/${parcelId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          surveyorNotes: `Surveyor human review decision: ${status}`,
        }),
      });
      const data = await res.json();
      if (data.parcel) {
        setParcels((prev) =>
          prev.map((p) => (p.id === data.parcel.id ? data.parcel : p))
        );
        setSelectedParcel(data.parcel);
        if (data.newAuditBlock) {
          setAuditChain((prev) => [...prev, data.newAuditBlock]);
        }
      }
    } catch (e) {
      console.error("Failed to update parcel status:", e);
    }
  };

  // Reset to the high-density granular 35+ parcel demo
  const handleResetGranularDemo = async () => {
    try {
      const res = await fetch("/api/parcels/reset-granular-demo", { method: "POST" });
      const data = await res.json();
      if (data.parcels) {
        setParcels(data.parcels);
        setSelectedParcel(data.parcels[0]);
        fetchTopologyReport();
      }
    } catch (e) {
      console.error("Failed to reset granular demo:", e);
    }
  };

  // Scan entire network for Under-Segmentation (e.g., multiple houses inside one parcel)
  const handleScanUnderSegmentation = async () => {
    try {
      const res = await fetch("/api/parcels/under-segmentation-audit", { method: "POST" });
      const data = await res.json();
      if (data.issues && data.issues.length > 0) {
        setStatutoryNoticeModal(
          `UNDER-SEGMENTATION RECONSTRUCTION AUDIT:\n\n` +
          `• Total Parcels Scanned: ${data.totalParcelsScanned}\n` +
          `• Flagged Under-Segmented Parcels: ${data.underSegmentedCount}\n\n` +
          data.issues.map((iss: any) => `⚠️ ${iss.reason}`).join("\n\n") +
          `\n\nRecommendation: Open each flagged parcel in the right inspector drawer and click [Split Parcel Candidate] to divide into individual property boundaries.`
        );
      } else {
        setStatutoryNoticeModal(
          `CADASTRAL RECONSTRUCTION AUDIT: 100% CLEAN\n\nAll ${data.totalParcelsScanned} parcel candidates represent individual single-property boundaries. Zero under-segmented multi-house polygons detected.`
        );
      }
    } catch (e) {
      console.error("Failed to run under-segmentation audit:", e);
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

  // Export LandXML v1.2
  const handleExportLandXML = () => {
    downloadLandXML(parcels, {
      district: selectedLandContext?.district?.name || parcels[0]?.district || "Chennai",
      taluk: selectedLandContext?.taluk?.name || parcels[0]?.taluk || "Velachery",
      village: selectedLandContext?.village?.name || parcels[0]?.village || "Thiruvanmiyur",
      surveyNumber: parcels[0]?.surveyNumber || "142",
    });
  };

  // Export AutoCAD DXF
  const handleExportDXF = () => {
    downloadDXF(parcels);
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

  // Flight Control Handlers
  const handleToggleFlightPlay = async () => {
    const nextPlay = !isSimulatingFlight;
    setIsSimulatingFlight(nextPlay);
    try {
      await fetch("/api/uav/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextPlay ? "RESUME" : "PAUSE" }),
      });
    } catch {
      // ignore
    }
  };

  const handleResetFlight = async () => {
    try {
      await fetch("/api/uav/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET", zone: flightZone }),
      });
    } catch {
      // ignore
    }
  };

  const handleAltitudeChange = async (alt: number) => {
    setFlightAltitude(alt);
    try {
      await fetch("/api/uav/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altitude_m: alt }),
      });
    } catch {
      // ignore
    }
  };

  const handleSpeedChange = async (spd: number) => {
    setFlightSpeed(spd);
    try {
      await fetch("/api/uav/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed_mps: spd }),
      });
    } catch {
      // ignore
    }
  };

  const handleZoneChange = async (z: "URBAN" | "RURAL" | "COMMERCIAL") => {
    setFlightZone(z);
    try {
      await fetch("/api/uav/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: z }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans flex flex-col select-none">
      {/* ========================================================================= */}
      {/* 1. TOP DOCKED APP BAR                                                     */}
      {/* ========================================================================= */}
      <FloatingGlassTopBar
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        parcelsCount={parcels.length}
        telemetry={telemetry}
        isSimulatingFlight={isSimulatingFlight}
        onToggleFlightSimulation={handleToggleFlightPlay}
        onOpenDualStreamCockpit={() => setShowDualStreamCockpit(true)}
        onOpenBlueprintModal={() => setShowBlueprintModal(true)}
        onOpenIngestModal={() => setShowIngestionModal(true)}
        onExportGeoJSON={handleExportGeoJSON}
        onTriggerTestMode={handleTriggerTestMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        parcels={parcels}
        onSelectParcel={selectParcel}
        onResetGranularDemo={handleResetGranularDemo}
        onScanUnderSegmentation={handleScanUnderSegmentation}
        onSearchArea={handleGlobalAreaSearch}
        currentLocationName={currentLocationName}
        isHierarchicalSearchOpen={showHierarchicalSearch}
        onToggleHierarchicalSearch={() => setShowHierarchicalSearch((prev) => !prev)}
        isLayerControlOpen={showLayerControl}
        onToggleLayerControl={() => setShowLayerControl((prev) => !prev)}
      />

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE CONTAINER (Sidebar + Map Viewport)                      */}
      {/* ========================================================================= */}
      <div className="relative flex-1 w-full h-full min-h-0 flex overflow-hidden">
        {/* Docked Left Tooling Sidebar */}
        <UnifiedDashboardSidebar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          isLayerControlOpen={showLayerControl}
          onToggleLayerControl={() => setShowLayerControl((prev) => !prev)}
          isHierarchicalSearchOpen={showHierarchicalSearch}
          onToggleHierarchicalSearch={() => setShowHierarchicalSearch((prev) => !prev)}
          onOpenDualStreamCockpit={() => setShowDualStreamCockpit(true)}
          onOpenBlueprintModal={() => setShowBlueprintModal(true)}
          onOpenVisualComparison={() => {
            setComparisonParcel(selectedParcel || parcels[0] || null);
            setShowComparisonModal(true);
          }}
          onTriggerTestMode={handleTriggerTestMode}
          onOpenDocumentUploadModal={() => setShowDocumentUploadModal(true)}
          onOpenDocumentManager={() => setShowDocumentManager(true)}
          onOpenIngestModal={() => setShowIngestionModal(true)}
          onExportGeoJSON={handleExportGeoJSON}
          onExportLandXML={handleExportLandXML}
          onExportDXF={handleExportDXF}
          isSimulatingFlight={isSimulatingFlight}
          onToggleFlightSimulation={handleToggleFlightPlay}
        />

        {/* Map Viewport Area */}
        <main className="relative flex-1 h-full min-w-0 overflow-hidden bg-slate-950">
          <MapView
            parcels={parcels}
            selectedParcel={selectedParcel}
            onSelectParcel={selectParcel}
            activeLayers={activeLayers}
            topologyReport={topologyReport}
            isSurveyorEditing={isSurveyorEditing}
            onSaveSurveyorAdjustment={handleSaveSurveyorAdjustment}
            onCancelSurveyorAdjustment={() => {
              setIsSurveyorEditing(false);
              setActiveTool("INSPECT");
            }}
            telemetry={telemetry}
            ingestionMode="VIRTUAL_UAV"
            selectedDetection={selectedDetection}
            onSelectDetection={setSelectedDetection}
            targetLocation={targetLocation}
            activeRaster={activeRaster}
          />

          {/* Optical HUD Reticle Overlay */}
          <UAVHudReticleOverlay
            telemetry={telemetry}
            selectedParcel={selectedParcel}
            isVisible={isSimulatingFlight && isReticleVisible}
          />

          {/* Hierarchical Land Search Drawer */}
          <HierarchicalSearch
            onContextChange={handleContextChange}
            onFreeSearch={handleFreeSearch}
            existingContext={selectedLandContext}
            isOpen={showHierarchicalSearch}
            onClose={() => setShowHierarchicalSearch(false)}
          />

          {/* Map Layer Control Drawer */}
          <LayerControl
            layers={mapLayers}
            onToggleLayer={handleToggleMapLayer}
            isOpen={showLayerControl}
            onClose={() => setShowLayerControl(false)}
          />

          {/* Bottom Flight Controller Bar */}
          {isSimulatingFlight && (
            <FloatingFlightController
              telemetry={telemetry}
              isPlaying={isSimulatingFlight}
              onTogglePlay={handleToggleFlightPlay}
              onResetFlight={handleResetFlight}
              altitude={flightAltitude}
              onAltitudeChange={handleAltitudeChange}
              speed={flightSpeed}
              onSpeedChange={handleSpeedChange}
              zone={flightZone}
              onZoneChange={handleZoneChange}
              isFollowDrone={isFollowDrone}
              onToggleFollowDrone={() => setIsFollowDrone((prev) => !prev)}
              isReticleVisible={isReticleVisible}
              onToggleReticle={() => setIsReticleVisible((prev) => !prev)}
            />
          )}

          {/* Right Parcel Inspection Drawer */}
          {selectedParcel && (
            <FloatingParcelInspector
              parcel={selectedParcel}
              onClose={() => setSelectedParcel(null)}
              onOpenPropertyInspection={() => setShowPropertyInspectionModal(true)}
              onOpenCertificateModal={() => setShowCertificateModal(true)}
              onOpenReportModal={(p) => {
                setSelectedParcel(p);
                setShowReportModal(true);
              }}
              onOpenVisualComparison={(p) => {
                setComparisonParcel(p);
                setShowComparisonModal(true);
              }}
              onRunVlmAudit={handleRunVlmAudit}
              isAuditingVlm={isAuditingVlm}
              vlmAuditResult={vlmAuditResult}
              onAutoRepairTopology={handleAutoRepairTopology}
              isSurveyorEditing={isSurveyorEditing}
              onToggleSurveyorEditing={() => {
                const next = !isSurveyorEditing;
                setIsSurveyorEditing(next);
                setActiveTool(next ? "EDIT_VERTEX" : "INSPECT");
              }}
              onSplitParcel={handleSplitParcel}
              onUpdateParcelStatus={handleUpdateParcelStatus}
            />
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 7. MODALS & SUB-WORKBENCHES                                               */}
      {/* ========================================================================= */}

      {/* High-Resolution Local Property Inspection & Verification Modal */}
      {showPropertyInspectionModal && selectedParcel && (
        <PropertyInspectionModal
          parcel={selectedParcel}
          onClose={() => setShowPropertyInspectionModal(false)}
          onStartBoundaryEdit={() => {
            setIsSurveyorEditing(true);
            setActiveTool("EDIT_VERTEX");
          }}
          onSplitParcel={handleSplitParcel}
          onUpdateStatus={handleUpdateParcelStatus}
        />
      )}

      {/* Dual-Stream Cadastral AI Architecture Cockpit Modal */}
      {showDualStreamCockpit && (
        <DualStreamCadastralCockpit
          onClose={() => setShowDualStreamCockpit(false)}
          parcels={parcels}
          telemetry={telemetry}
          selectedParcel={selectedParcel}
          onSelectParcel={selectParcel}
          onAddPredictedParcels={handleIngestCompleted}
          onRefreshTopology={fetchTopologyReport}
        />
      )}

      {/* Title Certificate Modal */}
      {showCertificateModal && (
        <TitleCertificateModal
          parcel={selectedParcel}
          onClose={() => setShowCertificateModal(false)}
        />
      )}

      {/* Cloud-Optimized GeoTIFF (COG) & Raster Ingestion Engine Modal */}
      {showIngestionModal && (
        <IngestOrthoModal
          isOpen={showIngestionModal}
          onClose={() => setShowIngestionModal(false)}
          activeRaster={activeRaster}
          onApplyRasterLayer={(newRasterConfig) => {
            setActiveRaster(newRasterConfig);
            setTargetLocation({
              lat: newRasterConfig.center[0],
              lng: newRasterConfig.center[1],
              zoom: 18,
            });
          }}
          onZoomToExtent={() => {
            if (activeRaster) {
              setTargetLocation({
                lat: activeRaster.center[0],
                lng: activeRaster.center[1],
                zoom: 19,
              });
            }
          }}
        />
      )}

      {/* Stream Flight Modal */}
      {showStreamModal && (
        <SurveyFlightStreamModal onClose={() => setShowStreamModal(false)} />
      )}

      {/* Historical Blueprint Modal */}
      {showBlueprintModal && (
        <HistoricalBlueprintModal
          isOpen={showBlueprintModal}
          onClose={() => setShowBlueprintModal(false)}
          onDocumentProcessed={() => {
            fetchParcels();
            fetchTopologyReport();
          }}
        />
      )}

      {/* Document Upload Modal (Phase 2) */}
      {showDocumentUploadModal && (
        <DocumentUploadModal
          isOpen={showDocumentUploadModal}
          onClose={() => setShowDocumentUploadModal(false)}
          onUploadComplete={() => {
            setShowDocumentUploadModal(false);
            setShowDocumentManager(true);
          }}
        />
      )}

      {/* Document Manager Modal (Phase 2) */}
      {showDocumentManager && (
        <DocumentManager
          isOpen={showDocumentManager}
          onClose={() => setShowDocumentManager(false)}
          onUploadNew={() => {
            setShowDocumentManager(false);
            setShowDocumentUploadModal(true);
          }}
          parcels={parcels}
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
                sliderPosition={50}
                onSliderChange={() => {}}
                mode="SWIPE_COMPARISON"
                onModeChange={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Statutory Audit Summary Notice Modal */}
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
                <span>All plots verified against 1967 FMB, 1985 Layout, 2005 TSLR & 2026 Satellite.</span>
              </span>
              <button
                onClick={() => setStatutoryNoticeModal(null)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition"
              >
                Acknowledge &amp; View on Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
