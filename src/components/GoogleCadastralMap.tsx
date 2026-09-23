import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import {
  Parcel,
  ActiveLayers,
  TopologyReport,
  UAVTelemetry,
  IngestionMode,
  GovLayoutRecord,
  EncroachmentDiscrepancy,
  FmbTemporalEpoch,
  PlotCongruenceRecord,
  FmbPlanHistoricalDataset,
  DriftHotspot,
} from "../types";
import { AIDetectionItem } from "./LiveDroneSplitView";
import {
  getLandTypeColor,
  getUncertaintyColor,
  calculateGeodesicDistanceMeters,
  calculateShoelaceArea,
  formatArea,
} from "../lib/geoUtils";
import {
  SnapConfig,
  SnapResult,
  computeTopologySnap,
} from "../lib/topologySnapping";
import {
  validateTopologyConstraints,
  TopologyValidationResult,
  VertexViolation,
} from "../lib/topologyValidation";
import { getParcelPaletteColor } from "../lib/cadastralSegmentationEngine";
import {
  ZoomIn,
  ZoomOut,
  Crosshair,
  Ruler,
  Layers,
  Edit3,
  Check,
  RotateCcw,
  Plane,
  Eye,
  Home,
  Trees,
  Search,
  MapPin,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Compass,
  Maximize2,
  Minimize2,
  Landmark,
  ShieldAlert,
  History,
  Clock,
  Sliders,
  Table,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Magnet,
  Grid,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";

// ==========================================
// SUBCOMPONENT: Google Maps Polygon Handler
// ==========================================

interface GooglePolygonProps {
  paths: google.maps.LatLngLiteral[];
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  zIndex?: number;
  clickable?: boolean;
  editable?: boolean;
  onClick?: () => void;
  onMouseOver?: (e: google.maps.MapMouseEvent) => void;
  onMouseOut?: () => void;
}

const GoogleMapPolygon: React.FC<GooglePolygonProps> = ({
  paths,
  fillColor = "#3B82F6",
  fillOpacity = 0.25,
  strokeColor = "#2563EB",
  strokeWeight = 2,
  strokeOpacity = 0.9,
  zIndex = 1,
  clickable = true,
  editable = false,
  onClick,
  onMouseOver,
  onMouseOut,
}) => {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map) return;

    const poly = new google.maps.Polygon({
      paths,
      fillColor,
      fillOpacity,
      strokeColor,
      strokeWeight,
      strokeOpacity,
      zIndex,
      clickable,
      editable,
      map,
    });

    polygonRef.current = poly;

    let clickListener: google.maps.MapsEventListener | null = null;
    let overListener: google.maps.MapsEventListener | null = null;
    let outListener: google.maps.MapsEventListener | null = null;

    if (onClick) {
      clickListener = poly.addListener("click", onClick);
    }
    if (onMouseOver) {
      overListener = poly.addListener("mouseover", onMouseOver);
    }
    if (onMouseOut) {
      outListener = poly.addListener("mouseout", onMouseOut);
    }

    return () => {
      clickListener?.remove();
      overListener?.remove();
      outListener?.remove();
      poly.setMap(null);
      polygonRef.current = null;
    };
  }, [map]);

  // Keep options in sync
  useEffect(() => {
    if (!polygonRef.current) return;
    polygonRef.current.setOptions({
      paths,
      fillColor,
      fillOpacity,
      strokeColor,
      strokeWeight,
      strokeOpacity,
      zIndex,
      clickable,
      editable,
    });
  }, [
    paths,
    fillColor,
    fillOpacity,
    strokeColor,
    strokeWeight,
    strokeOpacity,
    zIndex,
    clickable,
    editable,
  ]);

  return null;
};

// ==========================================
// SUBCOMPONENT: Google Maps Polyline Handler
// ==========================================

interface GooglePolylineProps {
  paths: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  zIndex?: number;
  geodesic?: boolean;
}

const GoogleMapPolyline: React.FC<GooglePolylineProps> = ({
  paths,
  strokeColor = "#F59E0B",
  strokeWeight = 3,
  strokeOpacity = 0.9,
  zIndex = 20,
  geodesic = true,
}) => {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || paths.length < 2) return;

    const polyline = new google.maps.Polyline({
      path: paths,
      strokeColor,
      strokeWeight,
      strokeOpacity,
      zIndex,
      geodesic,
      map,
    });

    polylineRef.current = polyline;

    return () => {
      polyline.setMap(null);
    };
  }, [map, paths, strokeColor, strokeWeight, strokeOpacity, zIndex, geodesic]);

  return null;
};

// ==========================================
// SUBCOMPONENT: Map Controller & Interaction
// ==========================================

interface MapControllerProps {
  selectedParcel: Parcel | null;
  targetLocation?: { lat: number; lng: number; zoom?: number } | null;
  measuringMode: boolean;
  onMapClick: (latLng: google.maps.LatLngLiteral) => void;
  onBoundsChange?: (bounds: [number, number, number, number]) => void;
  onZoomChange?: (zoom: number) => void;
}

const MapController: React.FC<MapControllerProps> = ({
  selectedParcel,
  targetLocation,
  measuringMode,
  onMapClick,
  onBoundsChange,
  onZoomChange,
}) => {
  const map = useMap();

  // Fly/Zoom to target location immediately when changed (real-time geocoding / preset selection)
  useEffect(() => {
    if (!map || !targetLocation) return;
    map.panTo({ lat: targetLocation.lat, lng: targetLocation.lng });
    if (typeof targetLocation.zoom === "number") {
      map.setZoom(targetLocation.zoom);
    }
  }, [map, targetLocation?.lat, targetLocation?.lng, targetLocation?.zoom]);

  // Clean Map Styling: Suppress noisy commercial POIs, stores, and transit to highlight cadastral boundaries
  useEffect(() => {
    if (!map) return;
    map.setOptions({
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      ],
    });
  }, [map]);

  // Zoom change listener for LOD decluttering
  useEffect(() => {
    if (!map || !onZoomChange) return;

    const listener = map.addListener("zoom_changed", () => {
      const z = map.getZoom();
      if (typeof z === "number") {
        onZoomChange(z);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onZoomChange]);

  // Click listener for measuring mode
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (measuringMode && e.latLng) {
        onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, measuringMode, onMapClick]);

  // Bounds change listener
  useEffect(() => {
    if (!map || !onBoundsChange) return;

    const listener = map.addListener("idle", () => {
      const bounds = map.getBounds();
      if (bounds) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        onBoundsChange([sw.lng(), sw.lat(), ne.lng(), ne.lat()]);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onBoundsChange]);

  // Fly/Zoom to selected parcel with optimal single-property high-res context
  useEffect(() => {
    if (!map || !selectedParcel) return;
    const lat =
      selectedParcel.centroid?.latitude ??
      (selectedParcel.coordinates?.length > 0 ? selectedParcel.coordinates[0][1] : undefined);
    const lng =
      selectedParcel.centroid?.longitude ??
      (selectedParcel.coordinates?.length > 0 ? selectedParcel.coordinates[0][0] : undefined);

    if (lat != null && lng != null) {
      map.panTo({ lat, lng });
      const currentZ = map.getZoom() || 18;
      if (currentZ < 19.5) {
        map.setZoom(20);
      }
    }
  }, [map, selectedParcel]);

  return null;
};

// ==========================================
// MAIN COMPONENT: GoogleCadastralMap
// ==========================================

export interface GoogleCadastralMapProps {
  apiKey: string;
  mapId?: string;
  parcels: Parcel[];
  selectedParcel: Parcel | null;
  onSelectParcel: (parcel: Parcel) => void;
  activeLayers: ActiveLayers;
  topologyReport: TopologyReport | null;
  isSurveyorEditing: boolean;
  onSaveSurveyorAdjustment: (updatedCoordinates: [number, number][], target?: "PARCEL" | "BUILDING") => void;
  onCancelSurveyorAdjustment: () => void;
  telemetry?: UAVTelemetry | null;
  ingestionMode?: IngestionMode;
  onMapBoundsChange?: (bounds: [number, number, number, number]) => void;
  onSwitchToLeaflet?: () => void;
  activeGovLayout?: GovLayoutRecord | null;
  activeDiscrepancy?: EncroachmentDiscrepancy | null;
  onOpenGovMapPanel?: () => void;
  historicalFmbDataset?: FmbPlanHistoricalDataset | null;
  onTriggerDetectAll?: () => void;
  isDetectingAll?: boolean;
  selectedPlotCongruence?: PlotCongruenceRecord | null;
  onSelectPlotCongruence?: (plot: PlotCongruenceRecord | null) => void;
  allDiscrepancies?: EncroachmentDiscrepancy[];
  driftHotspots?: DriftHotspot[];
  selectedDetection?: AIDetectionItem | null;
  onSelectDetection?: (detection: AIDetectionItem | null) => void;
  targetLocation?: { lat: number; lng: number; zoom?: number } | null;
}

export const GoogleCadastralMap: React.FC<GoogleCadastralMapProps> = ({
  apiKey,
  mapId = "DEMO_MAP_ID",
  parcels,
  selectedParcel,
  onSelectParcel,
  activeLayers,
  isSurveyorEditing,
  onSaveSurveyorAdjustment,
  onCancelSurveyorAdjustment,
  telemetry,
  onMapBoundsChange,
  onSwitchToLeaflet,
  activeGovLayout,
  activeDiscrepancy,
  onOpenGovMapPanel,
  historicalFmbDataset,
  onTriggerDetectAll,
  isDetectingAll = false,
  selectedPlotCongruence,
  onSelectPlotCongruence,
  allDiscrepancies,
  driftHotspots,
  selectedDetection,
  onSelectDetection,
  targetLocation,
}) => {

  // Historical FMB Multi-Temporal Epoch State (1967 - 2026)
  const [activeEpoch, setActiveEpoch] = useState<FmbTemporalEpoch>("ALL_EPOCHS_OVERLAY");
  const [showHistoricalTimelineBar, setShowHistoricalTimelineBar] = useState(true);
  const [showLadderTable, setShowLadderTable] = useState(false);

  // Map Type & View States
  const [mapTypeId, setMapTypeId] = useState<"hybrid" | "satellite" | "roadmap" | "terrain">("hybrid");
  const [tilt, setTilt] = useState<number>(0);
  const [heading, setHeading] = useState<number>(0);

  // House vs Vacant Land Perception Filter
  const [landFilter, setLandFilter] = useState<"ALL" | "HOUSES" | "VACANT">("ALL");
  const [showHousePerceptionOverlay, setShowHousePerceptionOverlay] = useState(true);

  // Surveyor Drag State
  const [editableCoords, setEditableCoords] = useState<[number, number][]>([]);

  // Tape Measure State
  const [measuringMode, setMeasuringMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<google.maps.LatLngLiteral[]>([]);

  // Hover Tooltip Info
  const [hoveredParcel, setHoveredParcel] = useState<Parcel | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Search Address State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Grounding Insight State
  const [groundingInsight, setGroundingInsight] = useState<string | null>(null);
  const [isLoadingGrounding, setIsLoadingGrounding] = useState(false);

  // AI Detections from Drone Camera Perception
  const [detections, setDetections] = useState<AIDetectionItem[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(18);

  useEffect(() => {
    fetch("/api/drone/detections")
      .then((res) => res.json())
      .then((data) => {
        if (data.detections) {
          setDetections(data.detections);
        }
      })
      .catch((err) => console.error("Failed to load detections for map:", err));
  }, []);

  // Survey Editing Target: Parcel Boundary Pegs vs. Building Rooftop Footprint
  const [surveyTarget, setSurveyTarget] = useState<"PARCEL" | "BUILDING">("PARCEL");

  // Helper to generate a clean, rectangular setback building footprint from parcel boundary
  const generateSetbackFootprint = (coords: [number, number][]): [number, number][] => {
    if (!coords || coords.length < 4) return [];
    const pts = coords.slice(0, coords.length - 1);
    const cLat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const cLng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const insetPts: [number, number][] = pts.map(([lng, lat]) => [
      lng * 0.78 + cLng * 0.22,
      lat * 0.78 + cLat * 0.22,
    ]);
    insetPts.push([insetPts[0][0], insetPts[0][1]]);
    return insetPts;
  };

  // Initialize editable coordinates when parcel or building editing begins
  useEffect(() => {
    if (!selectedParcel || !isSurveyorEditing) {
      setEditableCoords([]);
      return;
    }
    if (surveyTarget === "BUILDING") {
      if (selectedParcel.buildingFootprint && selectedParcel.buildingFootprint.length >= 3) {
        setEditableCoords([...selectedParcel.buildingFootprint]);
      } else {
        const generated = generateSetbackFootprint(selectedParcel.coordinates);
        setEditableCoords(generated);
      }
    } else {
      setEditableCoords([...selectedParcel.coordinates]);
    }
  }, [selectedParcel, isSurveyorEditing, surveyTarget]);

  // Topological Snapping & Survey Grid Alignment Configuration
  const [snapConfig, setSnapConfig] = useState<SnapConfig>({
    mode: "ALL",
    snapToleranceMeters: 2.5,
    gridResolutionMeters: 1.0,
    enableEdgeSnapping: true,
    enableVertexSnapping: true,
    enableGridSnapping: true,
  });
  const [activeSnapResult, setActiveSnapResult] = useState<SnapResult | null>(null);
  const [activeSnappedEdge, setActiveSnappedEdge] = useState<{ start: [number, number]; end: [number, number] } | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);

  // Handle vertex peg drag during surveyor boundary adjustment with auto-alignment
  const handleVertexDrag = (index: number, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const rawLat = e.latLng.lat();
    const rawLng = e.latLng.lng();

    // Compute topological snap against adjacent parcel boundaries, vertices and survey grid
    const snap = computeTopologySnap(
      [rawLng, rawLat],
      selectedParcel?.id,
      parcels,
      snapConfig
    );

    const [finalLng, finalLat] = snap.isSnapped ? snap.snappedPoint : [rawLng, rawLat];

    setDraggingVertexIndex(index);
    if (snap.isSnapped) {
      setActiveSnapResult(snap);
      if (snap.snapType === "EDGE" && snap.edgeStart && snap.edgeEnd) {
        setActiveSnappedEdge({ start: snap.edgeStart, end: snap.edgeEnd });
      } else {
        setActiveSnappedEdge(null);
      }
    } else {
      setActiveSnapResult(null);
      setActiveSnappedEdge(null);
    }

    setEditableCoords((prev) => {
      const updated = [...prev];
      updated[index] = [finalLng, finalLat];
      // If closing ring (first === last), keep both in sync
      if (index === 0 && updated.length > 1) {
        updated[updated.length - 1] = [finalLng, finalLat];
      } else if (index === updated.length - 1 && updated.length > 1) {
        updated[0] = [finalLng, finalLat];
      }
      return updated;
    });
  };

  const handleVertexDragEnd = () => {
    setDraggingVertexIndex(null);
    setTimeout(() => {
      setActiveSnappedEdge(null);
    }, 2500);
  };

  // Add Midpoint Peg between peg 1 and peg 2 for boundary or roof refinement
  const handleAddMidpointPeg = () => {
    if (editableCoords.length < 2) return;
    const p1 = editableCoords[0];
    const p2 = editableCoords[1];
    const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const updated: [number, number][] = [editableCoords[0], mid, ...editableCoords.slice(1)];
    setEditableCoords(updated);
  };

  // Delete last active vertex handle (must maintain closed polygon >= 3 edges)
  const handleDeleteLastVertex = () => {
    if (editableCoords.length <= 4) return;
    setEditableCoords((prev) => {
      const next = prev.slice(0, prev.length - 2);
      next.push(next[0]); // Maintain closed ring
      return next;
    });
  };

  // Revert boundary to original parcel or building coordinates
  const handleRevertBoundary = () => {
    if (selectedParcel) {
      if (surveyTarget === "BUILDING") {
        if (selectedParcel.buildingFootprint && selectedParcel.buildingFootprint.length >= 3) {
          setEditableCoords([...selectedParcel.buildingFootprint]);
        } else {
          setEditableCoords(generateSetbackFootprint(selectedParcel.coordinates));
        }
      } else {
        setEditableCoords([...selectedParcel.coordinates]);
      }
      setActiveSnapResult(null);
      setActiveSnappedEdge(null);
    }
  };

  // Calculate live area during surveyor editing
  const liveEditedArea = useMemo(() => {
    if (editableCoords.length < 3) return 0;
    return calculateShoelaceArea(editableCoords);
  }, [editableCoords]);

  // Real-time topological constraint verification for surveyor boundary editing
  const liveTopologyValidation = useMemo<TopologyValidationResult | null>(() => {
    if (!isSurveyorEditing || !selectedParcel || editableCoords.length < 3) {
      return null;
    }
    return validateTopologyConstraints(
      editableCoords,
      selectedParcel,
      parcels,
      surveyTarget
    );
  }, [isSurveyorEditing, selectedParcel, editableCoords, parcels, surveyTarget]);

  // Filtered parcels based on House / Vacant Land perception filter
  const displayedParcels = useMemo(() => {
    if (landFilter === "HOUSES") {
      return parcels.filter((p) => p.structureCount > 0);
    }
    if (landFilter === "VACANT") {
      return parcels.filter((p) => p.structureCount === 0);
    }
    return parcels;
  }, [parcels, landFilter]);

  // Preset location quick jumps
  const handleQuickJump = (lat: number, lng: number, label: string) => {
    setSearchFeedback(`Panned to ${label}`);
    setTimeout(() => setSearchFeedback(null), 3000);
  };

  // Search Address using Google Maps Geocoder via endpoint or client
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchFeedback(null);

    try {
      // Try geocoding through standard Google Maps API geocoder if loaded
      if ((window as any).google?.maps?.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: searchQuery }, (results: any, status: any) => {
          setIsSearching(false);
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            setSearchFeedback(`Found: ${results[0].formatted_address}`);
            // Center is set via local jump or map ref
          } else {
            setSearchFeedback("Location not found. Try entering a city or village name.");
          }
        });
      } else {
        setIsSearching(false);
        setSearchFeedback(`Searching for "${searchQuery}"...`);
      }
    } catch {
      setIsSearching(false);
    }
  };

  // Run Maps Grounding AI Audit
  const handleRunMapsGrounding = async () => {
    if (!selectedParcel) return;
    setIsLoadingGrounding(true);
    setGroundingInsight(null);

    try {
      const pLat = selectedParcel.centroid?.latitude ?? selectedParcel.coordinates?.[0]?.[1] ?? 28.6143;
      const pLng = selectedParcel.centroid?.longitude ?? selectedParcel.coordinates?.[0]?.[0] ?? 77.2095;
      const res = await fetch("/api/maps/grounding/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId: selectedParcel.id,
          locationQuery: `${selectedParcel.uprn}, New Delhi Cadastral Sector`,
          lat: pLat,
          lng: pLng,
        }),
      });
      const data = await res.json();
      if (data.grounding?.text) {
        setGroundingInsight(data.grounding.text);
      }
    } catch (e) {
      console.warn("Maps grounding error:", e);
    } finally {
      setIsLoadingGrounding(false);
    }
  };

  // Default cluster center: Velachery, Chennai / Tamil Nadu
  const defaultCenter = parcels.length > 0 && parcels[0].centroid
    ? { lat: parcels[0].centroid.latitude, lng: parcels[0].centroid.longitude }
    : { lat: 12.9839, lng: 80.2090 };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      <APIProvider apiKey={apiKey} libraries={["places", "marker", "geometry"]}>
        {/* Main Google Maps View */}
        <Map
          mapId={mapId || "DEMO_MAP_ID"}
          defaultCenter={defaultCenter}
          defaultZoom={18}
          mapTypeId={mapTypeId}
          tilt={tilt}
          heading={heading}
          gestureHandling="greedy"
          disableDefaultUI={true}
          className="w-full h-full"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        >
          {/* Map Event Controller */}
          <MapController
            selectedParcel={selectedParcel}
            targetLocation={targetLocation}
            measuringMode={measuringMode}
            onMapClick={(pt) => setMeasurePoints((prev) => [...prev, pt])}
            onBoundsChange={onMapBoundsChange}
            onZoomChange={setCurrentZoom}
          />

          {/* Render All Cadastral Parcels */}
          {displayedParcels.map((parcel, pIdx) => {
            const isSelected = selectedParcel?.id === parcel.id;
            const isEditingThis = isSelected && isSurveyorEditing && surveyTarget === "PARCEL" && editableCoords.length > 0;

            const coordsToRender = isEditingThis ? editableCoords : parcel.coordinates;
            const latLngPaths = coordsToRender.map(([lng, lat]) => ({ lat, lng }));

            // Harmonious Multi-Color Cadastral Palette - Distinct per adjacent property
            const isAnySelected = Boolean(selectedParcel);
            const palette = getParcelPaletteColor(pIdx, parcel.landType);
            let fillColor = palette.fill;
            let strokeColor = isSelected ? "#22d3ee" : isAnySelected ? "#475569" : palette.stroke;
            let fillOpacity = isSelected ? 0.30 : isAnySelected ? 0.04 : 0.10;
            let strokeWeight = isSelected ? 3.5 : isAnySelected ? 1.0 : 1.4;

            if (isSelected) {
              fillColor = "#06b6d4";
              strokeColor = "#22d3ee";
            } else if (showHousePerceptionOverlay) {
              if (parcel.structureCount > 0) {
                // House / Built-up
                fillColor = "#0284c7";
                strokeColor = isAnySelected ? "#475569" : "#38bdf8";
                fillOpacity = isSelected ? 0.30 : isAnySelected ? 0.04 : 0.08;
              } else {
                // Vacant Land / Open Plot
                fillColor = "#10b981";
                strokeColor = isAnySelected ? "#334155" : "#34d399";
                fillOpacity = isSelected ? 0.30 : isAnySelected ? 0.04 : 0.08;
              }
            } else if (activeLayers.uncertaintyBands) {
              const uColor = getUncertaintyColor(parcel.overallUncertainty);
              fillColor = uColor.hex;
              strokeColor = isAnySelected && !isSelected ? "#475569" : uColor.hex;
              fillOpacity = isSelected ? 0.30 : isAnySelected ? 0.04 : 0.12;
            } else if (activeLayers.zoningColors) {
              const zColor = getLandTypeColor(parcel.landType);
              fillColor = zColor.fill;
              strokeColor = isAnySelected && !isSelected ? "#475569" : zColor.stroke;
              fillOpacity = isSelected ? 0.30 : isAnySelected ? 0.04 : 0.10;
            }

            // Low-confidence inferred boundary style
            if (!isSelected && (1.0 - (parcel.overallUncertainty || 0.15)) < 0.65) {
              strokeColor = "#f59e0b"; // Warning amber for uncertain boundaries
            }

            if (activeLayers.topologyIssues && parcel.encroachmentDetected && !isSelected) {
              fillColor = "#ef4444";
              strokeColor = "#dc2626";
              fillOpacity = 0.15;
              strokeWeight = 2.0;
            }

            const pCentroidLat =
              parcel.centroid?.latitude ??
              (parcel.coordinates.length > 0
                ? parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length
                : 28.6143);
            const pCentroidLng =
              parcel.centroid?.longitude ??
              (parcel.coordinates.length > 0
                ? parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length
                : 77.2095);

            return (
              <React.Fragment key={parcel.id}>
                {/* Main Cadastral Parcel Polygon (Survey-grade thin boundary) */}
                <GoogleMapPolygon
                  paths={latLngPaths}
                  fillColor={fillColor}
                  fillOpacity={fillOpacity}
                  strokeColor={strokeColor}
                  strokeWeight={strokeWeight}
                  zIndex={isSelected ? 25 : 2}
                  onClick={() => onSelectParcel(parcel)}
                  onMouseOver={(e) => {
                    setHoveredParcel(parcel);
                    if (e.latLng) {
                      setHoverPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                    }
                  }}
                  onMouseOut={() => {
                    setHoveredParcel(null);
                    setHoverPosition(null);
                  }}
                />

                {/* High-Precision Architectural Building Footprint (Survey-Grade Respective Boundaries) */}
                {activeLayers.structuralFootprints && (parcel.buildingFootprint || parcel.structureCount > 0) && (() => {
                  const isEditingThisBuilding = isSelected && isSurveyorEditing && surveyTarget === "BUILDING" && editableCoords.length > 0;
                  let footprintCoords = isEditingThisBuilding ? editableCoords : parcel.buildingFootprint;
                  
                  // Only render if valid building footprint exists or if parcel is confirmed to have structures
                  if (!footprintCoords || footprintCoords.length < 3) {
                    if (!parcel.structureCount || parcel.structureCount <= 0) return null;
                    footprintCoords = generateSetbackFootprint(parcel.coordinates);
                    if (!footprintCoords || footprintCoords.length < 3) return null;
                  }

                  const bLatLngPaths = footprintCoords.map(([lng, lat]) => ({ lat, lng }));
                  const bCentroidLat = footprintCoords.reduce((sum, c) => sum + c[1], 0) / footprintCoords.length;
                  const bCentroidLng = footprintCoords.reduce((sum, c) => sum + c[0], 0) / footprintCoords.length;
                  const isHovered = hoveredParcel?.id === parcel.id;

                  return (
                    <React.Fragment key={`bld-footprint-${parcel.id}`}>
                      <GoogleMapPolygon
                        paths={bLatLngPaths}
                        fillColor={isEditingThisBuilding ? "#f59e0b" : isSelected ? "#38bdf8" : isHovered ? "#fbbf24" : "#f59e0b"}
                        fillOpacity={isEditingThisBuilding ? 0.60 : isSelected ? 0.45 : isHovered ? 0.35 : isAnySelected ? 0.16 : 0.28}
                        strokeColor={isEditingThisBuilding ? "#fbbf24" : isSelected ? "#0284c7" : isHovered ? "#d97706" : "#d97706"}
                        strokeWeight={isEditingThisBuilding ? 3.0 : isSelected ? 2.5 : isHovered ? 2.0 : 1.6}
                        zIndex={isEditingThisBuilding ? 40 : isSelected ? 28 : isHovered ? 20 : 8}
                        onClick={() => onSelectParcel(parcel)}
                        onMouseOver={(e) => {
                          setHoveredParcel(parcel);
                          if (e.latLng) {
                            setHoverPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                          }
                        }}
                        onMouseOut={() => {
                          setHoveredParcel(null);
                          setHoverPosition(null);
                        }}
                      />

                      {/* Respective Building Tag: Decluttered and perfectly sized to avoid label collisions */}
                      {parcel.buildingDetails && (isSelected || isHovered || currentZoom >= 19.2) && (
                        <AdvancedMarker
                          position={{ lat: bCentroidLat, lng: bCentroidLng }}
                          zIndex={isSelected ? 38 : isHovered ? 36 : 10}
                        >
                          {isSelected ? (
                            /* Selected Full Prominent Architectural Badge */
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectParcel(parcel);
                              }}
                              className="cursor-pointer px-2 py-0.5 rounded text-[9px] font-mono font-bold shadow-xl border transition-all whitespace-nowrap backdrop-blur-md bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/60 scale-105 flex items-center gap-1.5"
                              title={`${parcel.buildingDetails.buildingName} • ${parcel.buildingDetails.builtUpAreaSqM || 0}m² (${parcel.buildingDetails.roofType || "RCC Slab"})`}
                            >
                              <Home className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                              <span>{parcel.buildingDetails.buildingName.split("(")[0].trim()}</span>
                              <span className="text-[8px] opacity-80 border-l border-slate-950/40 pl-1 font-semibold">
                                {parcel.buildingDetails.builtUpAreaSqM || 0}m²
                              </span>
                            </div>
                          ) : isHovered ? (
                            /* Hover Expanded Preview Badge */
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectParcel(parcel);
                              }}
                              className="cursor-pointer px-2 py-0.5 rounded text-[8px] font-mono font-medium shadow-2xl border transition-all whitespace-nowrap backdrop-blur-md bg-slate-950/95 text-amber-300 border-amber-400 ring-1 ring-amber-400/50 flex items-center gap-1 scale-105 z-30"
                              title={`${parcel.buildingDetails.buildingName} (${parcel.buildingDetails.builtUpAreaSqM || 0}m²)`}
                            >
                              <Home className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span>{parcel.buildingDetails.buildingName.split("(")[0].trim()}</span>
                              <span className="text-slate-400 border-l border-slate-700 pl-1">
                                {parcel.buildingDetails.builtUpAreaSqM || 0}m²
                              </span>
                            </div>
                          ) : (
                            /* Compact Micro-Tag: Fits strictly inside the respective building boundary without colliding with neighboring plots */
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectParcel(parcel);
                              }}
                              className="cursor-pointer px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold shadow-md border transition-all whitespace-nowrap backdrop-blur-md bg-slate-950/85 text-amber-300/90 border-amber-500/35 hover:border-amber-400 hover:text-amber-200 max-w-[82px] truncate flex items-center gap-1"
                              title={`${parcel.buildingDetails.buildingName} (${parcel.buildingDetails.builtUpAreaSqM || 0}m²)`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              <span className="truncate">{parcel.buildingDetails.builtUpAreaSqM || 0}m²</span>
                            </div>
                          )}
                        </AdvancedMarker>
                      )}
                    </React.Fragment>
                  );
                })()}

                {/* Visible Property Corner Vertex Pegs (When Selected) */}
                {isSelected &&
                  parcel.coordinates.map(([vLng, vLat], vIdx) => (
                    <AdvancedMarker
                      key={`peg-${parcel.id}-${vIdx}`}
                      position={{ lat: vLat, lng: vLng }}
                      zIndex={40}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-white shadow-lg ring-2 ring-cyan-500/50 -translate-x-1.5 -translate-y-1.5" />
                    </AdvancedMarker>
                  ))}

                {/* Parcel Centroid Tag with Level-of-Detail (LOD) Decluttering */}
                {activeLayers.vectorBoundaries && (
                  <AdvancedMarker
                    position={{
                      lat: pCentroidLat,
                      lng: pCentroidLng,
                    }}
                    zIndex={isSelected ? 35 : 5}
                  >
                    {currentZoom < 18.0 ? (
                      /* Minimalist Micro-Pill Tag for Zoom < 18.0 */
                      <div
                        onClick={() => onSelectParcel(parcel)}
                        className={`cursor-pointer px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shadow-md border flex items-center gap-0.5 transition-all hover:scale-125 whitespace-nowrap backdrop-blur-md ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950 border-cyan-200 ring-2 ring-cyan-400/60 scale-110"
                            : parcel.encroachmentDetected
                            ? "bg-slate-950/90 text-rose-400 border-rose-500/50"
                            : "bg-slate-950/85 text-cyan-300 border-cyan-500/40"
                        }`}
                        title={`${parcel.uprn} - ${Math.round(parcel.calculatedAreaSqMeters)}m²`}
                      >
                        {parcel.surveyNumber || parcel.uprn.split("-").pop() || parcel.uprn}
                      </div>
                    ) : (
                      /* Full Tag Badge for Zoom >= 18.0 */
                      <div
                        onClick={() => onSelectParcel(parcel)}
                        className={`cursor-pointer px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold shadow-lg border flex items-center gap-1 transition-all hover:scale-110 whitespace-nowrap backdrop-blur-md ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950 border-cyan-200 ring-2 ring-cyan-400/60 scale-105"
                            : parcel.structureCount > 0
                            ? "bg-slate-950/90 text-amber-300 border-amber-500/40 hover:border-amber-400"
                            : "bg-slate-950/90 text-emerald-300 border-emerald-500/40 hover:border-emerald-400"
                        }`}
                        title={`${parcel.uprn} - ${Math.round(parcel.calculatedAreaSqMeters)}m² - ${parcel.ownerName}`}
                      >
                        {parcel.structureCount > 0 ? (
                          <Home className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        ) : (
                          <Trees className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        )}
                        <span>
                          {parcel.surveyNumber || parcel.uprn.split("-").pop() || parcel.uprn}
                        </span>
                        <span className={`text-[8px] border-l pl-1 ${isSelected ? 'text-slate-900 border-slate-900/30' : 'text-slate-400 border-slate-700'}`}>
                          {Math.round(parcel.calculatedAreaSqMeters)}m²
                        </span>
                        {parcel.encroachmentDetected && (
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0 animate-pulse" />
                        )}
                      </div>
                    )}
                  </AdvancedMarker>
                )}
              </React.Fragment>
            );
          })}

          {/* Real AI-Detected Physical Objects with Smart Decluttering */}
          {activeLayers.structuralFootprints &&
            detections.map((det) => {
              const isDetSelected = selectedDetection?.id === det.id;
              const isLinkedToSelected = selectedParcel?.id === det.linkedParcelId;
              const isDispute = det.multiParcelCrossing || det.status === "DISPUTED";
              const isBuilding = det.type === "BUILDING";

              // LOD check: Only show detection badge pin if selected or on dispute at very high zoom to avoid cluttering cadastral parcels
              const showDetectionBadge = isDetSelected || isLinkedToSelected || (isDispute && currentZoom >= 19.0);

              const dLatLngPaths = det.polygon.map(([lng, lat]) => ({ lat, lng }));
              const dCentroidLat =
                det.polygon.reduce((sum, c) => sum + c[1], 0) / det.polygon.length;
              const dCentroidLng =
                det.polygon.reduce((sum, c) => sum + c[0], 0) / det.polygon.length;

              const detFill = isDispute
                ? "#f43f5e"
                : isBuilding
                ? "#f59e0b"
                : det.type === "ROAD"
                ? "#6366f1"
                : "#10b981";

              const detStroke = isDispute
                ? "#e11d48"
                : isBuilding
                ? "#d97706"
                : det.type === "ROAD"
                ? "#4f46e5"
                : "#059669";

              return (
                <React.Fragment key={`ai-det-${det.id}`}>
                  <GoogleMapPolygon
                    paths={dLatLngPaths}
                    fillColor={detFill}
                    fillOpacity={isDetSelected ? 0.35 : isDispute ? 0.25 : 0.15}
                    strokeColor={detStroke}
                    strokeWeight={isDetSelected ? 2.5 : 1.5}
                    zIndex={isDetSelected ? 35 : 15}
                    onClick={() => {
                      onSelectDetection?.(det);
                      if (det.linkedParcelId) {
                        const linked = parcels.find((p) => p.id === det.linkedParcelId);
                        if (linked) onSelectParcel(linked);
                      }
                    }}
                  />

                  {/* Detection Label Pin (Shown only at high zoom or when active) */}
                  {showDetectionBadge && (
                    <AdvancedMarker
                      position={{ lat: dCentroidLat, lng: dCentroidLng }}
                      zIndex={isDetSelected ? 40 : 18}
                    >
                      <div
                        onClick={() => {
                          onSelectDetection?.(det);
                          if (det.linkedParcelId) {
                            const linked = parcels.find((p) => p.id === det.linkedParcelId);
                            if (linked) onSelectParcel(linked);
                          }
                        }}
                        className={`cursor-pointer px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shadow-md border flex items-center gap-1 transition-all hover:scale-110 whitespace-nowrap backdrop-blur-md ${
                          isDetSelected
                            ? "bg-cyan-500 text-slate-950 border-cyan-200 ring-2 ring-cyan-400/50"
                            : isDispute
                            ? "bg-rose-950/90 text-rose-300 border-rose-500/60"
                            : isBuilding
                            ? "bg-amber-950/90 text-amber-300 border-amber-500/60"
                            : "bg-slate-900/90 text-emerald-300 border-emerald-500/60"
                        }`}
                        title={`${det.label} - ${det.areaSqM}m² (${Math.round(det.confidence * 100)}%)`}
                      >
                        {isDispute ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0 animate-pulse" />
                        ) : (
                          <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        )}
                        <span>{det.id}</span>
                        <span className="text-[7px] opacity-75">
                          {Math.round(det.areaSqM)}m²
                        </span>
                      </div>
                    </AdvancedMarker>
                  )}
                </React.Fragment>
              );
            })}

          {/* Drone Camera Ground Footprint (Geographic Field of View) */}
          {telemetry?.camera_footprint_bbox && telemetry.camera_footprint_bbox.length >= 4 && (
            <GoogleMapPolygon
              paths={telemetry.camera_footprint_bbox.map(([lng, lat]) => ({ lat, lng }))}
              fillColor="#06b6d4"
              fillOpacity={0.06}
              strokeColor="#22d3ee"
              strokeWeight={1.8}
              strokeOpacity={0.85}
              zIndex={8}
            />
          )}

          {/* Surveyor Interactive Vertex Editing Draggable Markers with Topological QC Feedback */}
          {isSurveyorEditing &&
            selectedParcel &&
            editableCoords.map(([lng, lat], idx) => {
              if (idx === editableCoords.length - 1 && editableCoords.length > 1) {
                return null; // Skip redundant closing node
              }
              const isBeingDragged = draggingVertexIndex === idx;
              const isViolating = liveTopologyValidation?.violatingVertexIndices.has(idx) ?? false;
              const vertexViolations = liveTopologyValidation?.violationsByVertex.get(idx) || [];
              const primaryViolation = vertexViolations[0];

              return (
                <AdvancedMarker
                  key={`edit-peg-${idx}`}
                  position={{ lat, lng }}
                  draggable={true}
                  onDrag={(e) => handleVertexDrag(idx, e)}
                  onDragEnd={handleVertexDragEnd}
                  zIndex={isBeingDragged ? 160 : isViolating ? 150 : 100}
                >
                  <div className="group relative -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing">
                    {/* Pulsing Alert Halo for Violating Vertex */}
                    {isViolating && (
                      <div className="absolute -inset-2.5 rounded-full bg-rose-500/40 animate-ping pointer-events-none" />
                    )}

                    <div
                      className={`rounded-full border-2 shadow-2xl flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                        isViolating
                          ? "w-6 h-6 bg-rose-600 border-white text-white scale-125 ring-4 ring-rose-500/90 shadow-[0_0_20px_rgba(244,63,94,0.95)] animate-pulse"
                          : isBeingDragged && activeSnapResult?.isSnapped
                          ? "w-5 h-5 bg-emerald-400 scale-125 ring-4 ring-emerald-400/60 border-slate-950 text-slate-950"
                          : surveyTarget === "BUILDING"
                          ? "w-5 h-5 bg-amber-400 ring-4 ring-amber-500/50 hover:scale-110 border-slate-950 text-slate-950"
                          : "w-5 h-5 bg-sky-400 ring-4 ring-sky-400/40 hover:scale-110 border-slate-950 text-slate-950"
                      }`}
                    >
                      {isViolating ? (
                        <span className="font-black text-xs text-white">!</span>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    {/* Hover & Immediate Violation Tooltip */}
                    <div
                      className={`absolute left-7 top-0 pointer-events-none rounded-xl px-2.5 py-1.5 shadow-2xl z-50 text-[10px] backdrop-blur-md border transition-all ${
                        isViolating
                          ? "block bg-slate-950/95 border-rose-500 text-rose-200 min-w-[210px] max-w-xs whitespace-normal shadow-[0_4px_20px_rgba(225,29,72,0.35)]"
                          : "hidden group-hover:block bg-slate-900 border-slate-700 text-amber-300 whitespace-nowrap"
                      }`}
                    >
                      {isViolating && primaryViolation ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 font-bold text-rose-400">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                            <span>⚠️ {primaryViolation.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-200 leading-snug">
                            {primaryViolation.description}
                          </p>
                          <div className="text-[9px] font-mono text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-700/50 mt-0.5">
                            QC Rule: {primaryViolation.violationType === "SELF_INTERSECTION" ? "Eliminate bowtie / crossing segment" : "Prevent legal overlap"}
                          </div>
                        </div>
                      ) : (
                        <span>
                          {surveyTarget === "BUILDING" ? `Roof Corner #${idx + 1}` : `Boundary Peg #${idx + 1}`} • Drag to snap to edges &amp; grid
                        </span>
                      )}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}

          {/* Real-Time Topological Violation Segment Highlights (Glowing Red Lines) */}
          {isSurveyorEditing &&
            liveTopologyValidation &&
            !liveTopologyValidation.isValid &&
            liveTopologyValidation.violatingSegments.map((seg, sIdx) => (
              <GoogleMapPolyline
                key={`topo-violating-seg-${sIdx}`}
                paths={[
                  { lat: seg.start[1], lng: seg.start[0] },
                  { lat: seg.end[1], lng: seg.end[0] },
                ]}
                strokeColor="#f43f5e"
                strokeWeight={5}
                strokeOpacity={0.92}
                zIndex={125}
              />
            ))}

          {/* Self-Intersection Point Reticle Alerts */}
          {isSurveyorEditing &&
            liveTopologyValidation &&
            liveTopologyValidation.intersectionPoints.map((pt, pIdx) => (
              <AdvancedMarker
                key={`inter-pt-${pIdx}`}
                position={{ lat: pt.point[1], lng: pt.point[0] }}
                zIndex={170}
              >
                <div className="relative -translate-x-1/2 -translate-y-1/2 pointer-events-none group">
                  <div className="w-7 h-7 rounded-full bg-rose-600/40 border-2 border-rose-500 flex items-center justify-center animate-ping absolute inset-0" />
                  <div className="w-5 h-5 rounded-full bg-rose-600 border-2 border-white shadow-[0_0_12px_rgba(244,63,94,1)] flex items-center justify-center text-white text-[10px] font-black">
                    ✕
                  </div>
                  <div className="absolute left-6 -top-1 bg-slate-950/95 border border-rose-500 text-rose-200 text-[9px] px-2 py-1 rounded-md shadow-xl whitespace-nowrap z-50">
                    <span className="font-bold text-rose-300">Self-Intersection Point</span>
                    <div className="text-slate-300 font-mono text-[8px]">{pt.label}</div>
                  </div>
                </div>
              </AdvancedMarker>
            ))}

          {/* Active Topological Snap Feedback Overlays */}
          {isSurveyorEditing && activeSnapResult?.isSnapped && (
            <>
              {/* Highlighted Adjacent Boundary Edge being magnetically snapped to */}
              {activeSnappedEdge && (
                <GoogleMapPolyline
                  paths={[
                    { lat: activeSnappedEdge.start[1], lng: activeSnappedEdge.start[0] },
                    { lat: activeSnappedEdge.end[1], lng: activeSnappedEdge.end[0] },
                  ]}
                  strokeColor="#10b981"
                  strokeWeight={4.5}
                  strokeOpacity={0.95}
                  zIndex={120}
                />
              )}

              {/* Glowing Snap Reticle Marker at Snapped Coordinate */}
              <AdvancedMarker
                position={{
                  lat: activeSnapResult.snappedPoint[1],
                  lng: activeSnapResult.snappedPoint[0],
                }}
                zIndex={140}
              >
                <div className="relative -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div
                    className={`absolute -inset-3 rounded-full animate-ping opacity-60 ${
                      activeSnapResult.snapType === "VERTEX"
                        ? "bg-emerald-400"
                        : activeSnapResult.snapType === "EDGE"
                        ? "bg-cyan-400"
                        : "bg-amber-400"
                    }`}
                  />
                  <div
                    className={`w-6 h-6 rounded-full border-2 border-white shadow-2xl flex items-center justify-center font-bold text-[9px] text-white ${
                      activeSnapResult.snapType === "VERTEX"
                        ? "bg-emerald-500 ring-2 ring-emerald-400"
                        : activeSnapResult.snapType === "EDGE"
                        ? "bg-cyan-500 ring-2 ring-cyan-400"
                        : "bg-amber-500 ring-2 ring-amber-400"
                    }`}
                  >
                    <Magnet className="w-3.5 h-3.5" />
                  </div>

                  {/* High-visibility Cadastral Snap Pill */}
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 bg-slate-950/95 border border-emerald-400/80 text-emerald-300 text-[10px] font-mono font-bold px-2 py-1 rounded-lg shadow-2xl whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{activeSnapResult.description}</span>
                    <span className="text-[9px] text-slate-400 font-normal border-l border-slate-700 pl-1.5">
                      {activeSnapResult.topologicalBenefit}
                    </span>
                  </div>
                </div>
              </AdvancedMarker>
            </>
          )}

          {/* Tape Measure Pegs & Lines */}
          {measuringMode && (
            <>
              {measurePoints.map((pt, idx) => (
                <AdvancedMarker key={`measure-${idx}`} position={pt} zIndex={120}>
                  <div className="w-5 h-5 rounded-full bg-sky-500 border-2 border-white shadow-xl flex items-center justify-center text-[9px] font-bold text-slate-950">
                    {idx + 1}
                  </div>
                </AdvancedMarker>
              ))}

              {measurePoints.length > 2 && (
                <GoogleMapPolygon
                  paths={measurePoints}
                  fillColor="#38bdf8"
                  fillOpacity={0.25}
                  strokeColor="#0284c7"
                  strokeWeight={2}
                  zIndex={110}
                />
              )}
            </>
          )}

          {/* Real-time UAV Flight Telemetry Marker */}
          {telemetry && (() => {
            const droneLat = telemetry.latitude ?? (telemetry as any).coordinates?.latitude;
            const droneLng = telemetry.longitude ?? (telemetry as any).coordinates?.longitude;
            if (droneLat == null || droneLng == null) return null;

            const droneHeading = telemetry.heading_deg ?? (telemetry as any).heading ?? 0;
            const droneAlt = telemetry.altitude_agl ?? (telemetry as any).altitudeAGL ?? 80;
            const droneGsd = telemetry.gsd_cm_px ?? (telemetry as any).gsd ?? 2.1;

            return (
              <AdvancedMarker
                position={{
                  lat: droneLat,
                  lng: droneLng,
                }}
                zIndex={200}
              >
                <div
                  className="relative -translate-x-1/2 -translate-y-1/2 transition-transform duration-300"
                  style={{ transform: `rotate(${droneHeading}deg)` }}
                >
                  {/* Camera Sensor FOV Frustum Cone */}
                  <div className="absolute -top-10 -left-6 w-12 h-12 bg-sky-400/20 border-t-2 border-sky-400/60 rounded-t-full pointer-events-none" />

                  {/* Drone Icon */}
                  <div className="w-9 h-9 rounded-full bg-slate-950 border-2 border-sky-400 shadow-2xl flex items-center justify-center text-sky-400 ring-4 ring-sky-500/30">
                    <Plane className="w-4 h-4 transform -rotate-45" />
                  </div>

                  {/* Telemetry Tag - counter-rotated so text is always horizontally upright and never inverted */}
                  <div
                    className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-sky-500 text-sky-300 text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap"
                    style={{ transform: `translateX(-50%) rotate(${-droneHeading}deg)` }}
                  >
                    ALT: {Math.round(droneAlt)}m • GSD: {droneGsd.toFixed(1)}cm
                  </div>
                </div>
              </AdvancedMarker>
            );
          })()}

          {/* Hover Inspection InfoWindow */}
          {hoveredParcel && hoverPosition && !isSurveyorEditing && (
            <InfoWindow
              position={hoverPosition}
              onCloseClick={() => {
                setHoveredParcel(null);
                setHoverPosition(null);
              }}
              headerDisabled={true}
            >
              <div className="p-1 text-slate-900 font-sans text-xs max-w-[200px]">
                <div className="font-bold flex items-center gap-1 text-slate-950">
                  {hoveredParcel.structureCount > 0 ? (
                    <Home className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Trees className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{hoveredParcel.uprn}</span>
                </div>
                <div className="text-[11px] text-slate-600 truncate mt-0.5">
                  Owner: {hoveredParcel.ownerName}
                </div>
                <div className="text-[11px] font-semibold text-sky-700 mt-0.5">
                  Area: {formatArea(hoveredParcel.calculatedAreaSqMeters).sqm} m²
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      hoveredParcel.structureCount > 0 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <span>
                    {hoveredParcel.structureCount > 0
                      ? `${hoveredParcel.structureCount} House / Structure`
                      : "Vacant Open Land"}
                  </span>
                </div>
              </div>
            </InfoWindow>
          )}
          {/* Tamil Nadu Government Approved Legal Layout Overlays (L_legal) */}
          {activeGovLayout && (
            <>
              {activeGovLayout.legalBoundaries.map((b, idx) => {
                const paths = b.coordinates.map(([lng, lat]) => ({ lat, lng }));
                const isRoad = b.intendedUse === "ROAD_RESERVE";
                const isOsr = b.intendedUse === "PARK_OSR";
                const fillColor = isRoad ? "#f59e0b" : isOsr ? "#10b981" : "#0284c7";
                const strokeColor = isRoad ? "#d97706" : isOsr ? "#059669" : "#38bdf8";

                const cLat = paths.reduce((s, p) => s + p.lat, 0) / paths.length;
                const cLng = paths.reduce((s, p) => s + p.lng, 0) / paths.length;

                return (
                  <React.Fragment key={`gov-b-${idx}`}>
                    <GoogleMapPolygon
                      paths={paths}
                      fillColor={fillColor}
                      fillOpacity={isRoad ? 0.35 : isOsr ? 0.3 : 0.15}
                      strokeColor={strokeColor}
                      strokeWeight={3}
                      strokeOpacity={0.9}
                      zIndex={isRoad ? 25 : 8}
                    />

                    {/* Official Legal Plot / Road Reserve Tag (Hidden if vector parcel boundaries already render tags to avoid duplicate overlay) */}
                    {(!activeLayers.vectorBoundaries || isRoad || isOsr) && (
                      <AdvancedMarker position={{ lat: cLat, lng: cLng }} zIndex={30}>
                        <div
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold shadow-lg border backdrop-blur-sm whitespace-nowrap ${
                            isRoad
                              ? "bg-amber-950/90 text-amber-300 border-amber-500"
                              : isOsr
                              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500"
                              : "bg-sky-950/90 text-sky-300 border-sky-500"
                          }`}
                        >
                          <span>{b.plotNumber}</span>
                          <span className="opacity-75 ml-1">({Math.round(b.legalAreaSqM)}m²)</span>
                        </div>
                      </AdvancedMarker>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Georeferencing Ground Control Points (GCPs) */}
              {activeGovLayout.gcpList?.map((gcp) => (
                <AdvancedMarker
                  key={gcp.id}
                  position={{ lat: gcp.targetLat, lng: gcp.targetLng }}
                  zIndex={40}
                >
                  <div className="flex flex-col items-center group cursor-pointer">
                    <div className="w-6 h-6 rounded-full bg-slate-950 border-2 border-amber-400 text-amber-400 flex items-center justify-center shadow-lg font-bold text-[10px]">
                      GCP
                    </div>
                    <div className="bg-slate-900/95 border border-amber-500/70 text-amber-300 text-[8px] font-mono px-1 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
                      {gcp.name} (±{(gcp.residualMeters || 0.08).toFixed(2)}m)
                    </div>
                  </div>
                </AdvancedMarker>
              ))}
            </>
          )}

          {/* Comparative Encroachment Zone E = B_detected \ L_legal */}
          {activeDiscrepancy && (
            <>
              {/* Detected Physical Satellite Footprint B_detected */}
              <GoogleMapPolygon
                paths={activeDiscrepancy.detectedPhysicalBoundary.map(([lng, lat]) => ({ lat, lng }))}
                fillColor="#eab308"
                fillOpacity={0.2}
                strokeColor="#ca8a04"
                strokeWeight={2}
                strokeOpacity={0.8}
                zIndex={18}
              />

              {/* Encroachment Discrepancy Red Warning Zone E */}
              <GoogleMapPolygon
                paths={activeDiscrepancy.encroachmentPolygon.map(([lng, lat]) => ({ lat, lng }))}
                fillColor="#ef4444"
                fillOpacity={0.65}
                strokeColor="#b91c1c"
                strokeWeight={3}
                strokeOpacity={1}
                zIndex={35}
              />

              {/* Discrepancy Alert Badge */}
              {activeDiscrepancy.encroachmentPolygon.length > 0 && (
                <AdvancedMarker
                  position={{
                    lat:
                      activeDiscrepancy.encroachmentPolygon.reduce((s, p) => s + p[1], 0) /
                      activeDiscrepancy.encroachmentPolygon.length,
                    lng:
                      activeDiscrepancy.encroachmentPolygon.reduce((s, p) => s + p[0], 0) /
                      activeDiscrepancy.encroachmentPolygon.length,
                  }}
                  zIndex={50}
                >
                  <div className="px-2.5 py-1 rounded-lg bg-rose-950 border-2 border-rose-500 text-white font-bold text-[10px] shadow-2xl flex items-center gap-1.5 animate-pulse whitespace-nowrap">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      Encroachment: {activeDiscrepancy.maxDeviationMeters}m into Road Reserve (
                      {activeDiscrepancy.encroachmentAreaSqM}m²)
                    </span>
                  </div>
                </AdvancedMarker>
              )}
            </>
          )}

          {/* ==================================================== */}
          {/* HISTORICAL FMB / FMDP MULTI-EPOCH LAYERS (1967–2026) */}
          {/* ==================================================== */}
          {historicalFmbDataset && (
            <>
              {/* 1. 1967 Re-Survey Theodolite G-Line Baseline */}
              {(activeEpoch === "1967_FMB_SURVEY" || activeEpoch === "ALL_EPOCHS_OVERLAY") && (
                <>
                  <GoogleMapPolyline
                    paths={[
                      { lat: historicalFmbDataset.gLine.startCoord[1], lng: historicalFmbDataset.gLine.startCoord[0] },
                      { lat: historicalFmbDataset.gLine.endCoord[1], lng: historicalFmbDataset.gLine.endCoord[0] },
                    ]}
                    strokeColor="#d97706"
                    strokeWeight={4}
                    strokeOpacity={0.9}
                    zIndex={32}
                  />

                  {/* Start Stone Station */}
                  <AdvancedMarker
                    position={{
                      lat: historicalFmbDataset.gLine.startCoord[1],
                      lng: historicalFmbDataset.gLine.startCoord[0],
                    }}
                    zIndex={35}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-amber-200 text-slate-950 flex items-center justify-center shadow-lg font-bold text-[9px]">
                        S1
                      </div>
                      <div className="bg-amber-950/90 border border-amber-500/70 text-amber-200 text-[8px] font-mono px-1 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
                        Tri-junction Stone (1967)
                      </div>
                    </div>
                  </AdvancedMarker>

                  {/* End Stone Station */}
                  <AdvancedMarker
                    position={{
                      lat: historicalFmbDataset.gLine.endCoord[1],
                      lng: historicalFmbDataset.gLine.endCoord[0],
                    }}
                    zIndex={35}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-amber-200 text-slate-950 flex items-center justify-center shadow-lg font-bold text-[9px]">
                        S2
                      </div>
                      <div className="bg-amber-950/90 border border-amber-500/70 text-amber-200 text-[8px] font-mono px-1 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
                        NE Theodolite Datum
                      </div>
                    </div>
                  </AdvancedMarker>

                  {/* G-Line Metadata Label */}
                  <AdvancedMarker
                    position={{
                      lat: (historicalFmbDataset.gLine.startCoord[1] + historicalFmbDataset.gLine.endCoord[1]) / 2,
                      lng: (historicalFmbDataset.gLine.startCoord[0] + historicalFmbDataset.gLine.endCoord[0]) / 2,
                    }}
                    zIndex={34}
                  >
                    <div className="px-2 py-0.5 rounded bg-amber-950/95 border border-amber-500/80 text-amber-300 text-[9px] font-mono font-bold shadow-xl backdrop-blur-sm whitespace-nowrap flex items-center gap-1">
                      <span>📐 G-Line: {historicalFmbDataset.gLine.lengthMeters}m (Az: {historicalFmbDataset.gLine.azimuthDeg}°)</span>
                    </div>
                  </AdvancedMarker>

                  {/* Ladder Offset Stations along G-Line */}
                  {historicalFmbDataset.gLine.ladderStations.map((station, sIdx) => (
                    <AdvancedMarker key={`ladder-stn-${sIdx}`} position={{ lat: station.lat, lng: station.lng }} zIndex={33}>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-900 shadow" title={station.label} />
                    </AdvancedMarker>
                  ))}
                </>
              )}

              {/* 2. Plot Polygons Across Selected Epoch */}
              {historicalFmbDataset.plots.map((plot) => {
                const getEpochPolygon = () => {
                  switch (activeEpoch) {
                    case "1967_FMB_SURVEY":
                      return {
                        coords: plot.boundary1967,
                        color: "#d97706",
                        label: "1967 FMB Re-Survey",
                      };
                    case "1985_SUBDIVISION":
                      return {
                        coords: plot.boundary1985,
                        color: "#0284c7",
                        label: "1985 Sub-Division",
                      };
                    case "2005_TSLR_DIGITAL":
                      return {
                        coords: plot.boundary2005,
                        color: "#6366f1",
                        label: "2005 TSLR Digital",
                      };
                    case "2026_SATELLITE_DETECTED":
                      return {
                        coords: plot.boundary2026Satellite,
                        color: plot.equallySketched ? "#10b981" : plot.driftType === "BOUNDARY_DRIFT" ? "#f59e0b" : "#ef4444",
                        label: "2026 Satellite Footprint",
                      };
                    case "ALL_EPOCHS_OVERLAY":
                    default:
                      return null;
                  }
                };

                const singleEpoch = getEpochPolygon();

                if (singleEpoch) {
                  const paths = singleEpoch.coords.map(([lng, lat]) => ({ lat, lng }));
                  const cLat = paths.reduce((s, p) => s + p.lat, 0) / paths.length;
                  const cLng = paths.reduce((s, p) => s + p.lng, 0) / paths.length;

                  return (
                    <React.Fragment key={`epoch-plot-${plot.plotId}`}>
                      <GoogleMapPolygon
                        paths={paths}
                        fillColor={singleEpoch.color}
                        fillOpacity={0.25}
                        strokeColor={singleEpoch.color}
                        strokeWeight={2.5}
                        strokeOpacity={0.9}
                        zIndex={22}
                        onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(plot)}
                      />
                      <AdvancedMarker position={{ lat: cLat, lng: cLng }} zIndex={30}>
                        <div
                          onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(plot)}
                          className="px-2 py-0.5 rounded text-[9px] font-mono font-bold shadow-lg border backdrop-blur-sm whitespace-nowrap cursor-pointer hover:scale-105 transition"
                          style={{
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            borderColor: singleEpoch.color,
                            color: singleEpoch.color,
                          }}
                        >
                          <span>{plot.plotNumber}</span>
                          <span className="opacity-80 ml-1">({singleEpoch.label})</span>
                        </div>
                      </AdvancedMarker>
                    </React.Fragment>
                  );
                }

                // ALL_EPOCHS_OVERLAY: Comparative Sketching Analysis (1967 vs 2026)
                const satPaths = plot.boundary2026Satellite.map(([lng, lat]) => ({ lat, lng }));
                const fmb1967Paths = plot.boundary1967.map(([lng, lat]) => ({ lat, lng }));
                const cLat = satPaths.reduce((s, p) => s + p.lat, 0) / satPaths.length;
                const cLng = satPaths.reduce((s, p) => s + p.lng, 0) / satPaths.length;

                const isDrift = plot.driftType === "BOUNDARY_DRIFT";

                const strokeColor = plot.equallySketched
                  ? "#10b981"
                  : isDrift
                  ? "#f59e0b"
                  : "#ef4444";

                return (
                  <React.Fragment key={`all-epochs-${plot.plotId}`}>
                    {/* 1967 Baseline Boundary (Dashed/Sepia) */}
                    <GoogleMapPolyline
                      paths={[...fmb1967Paths, fmb1967Paths[0]]}
                      strokeColor="#d97706"
                      strokeWeight={2}
                      strokeOpacity={0.65}
                      zIndex={15}
                    />

                    {/* 2026 Detected Physical Boundary */}
                    <GoogleMapPolygon
                      paths={satPaths}
                      fillColor={strokeColor}
                      fillOpacity={plot.equallySketched ? 0.15 : isDrift ? 0.25 : 0.3}
                      strokeColor={strokeColor}
                      strokeWeight={plot.equallySketched ? 2 : 3}
                      strokeOpacity={0.9}
                      zIndex={20}
                      onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(plot)}
                    />

                    {/* Encroachment polygon if present */}
                    {plot.encroachmentPolygon && (
                      <GoogleMapPolygon
                        paths={plot.encroachmentPolygon.map(([lng, lat]) => ({ lat, lng }))}
                        fillColor="#ef4444"
                        fillOpacity={0.7}
                        strokeColor="#b91c1c"
                        strokeWeight={3}
                        strokeOpacity={1}
                        zIndex={38}
                        onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(plot)}
                      />
                    )}

                    {/* Equivalence Congruence Badge */}
                    <AdvancedMarker position={{ lat: cLat, lng: cLng }} zIndex={36}>
                      <div
                        onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(plot)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-sans font-bold shadow-xl border backdrop-blur-md whitespace-nowrap cursor-pointer hover:scale-105 transition flex items-center gap-1 ${
                          plot.equallySketched
                            ? "bg-emerald-950/95 text-emerald-300 border-emerald-500/80 hover:border-emerald-400"
                            : isDrift
                            ? "bg-amber-950/95 text-amber-300 border-amber-500/80 hover:border-amber-400"
                            : "bg-rose-950/95 text-rose-200 border-2 border-rose-500 hover:border-rose-400 animate-pulse"
                        }`}
                        title={plot.auditRemark}
                      >
                        {plot.equallySketched ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{plot.plotNumber}: Equally Sketched (±{plot.maxBoundaryShiftMeters}m)</span>
                          </>
                        ) : isDrift ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{plot.plotNumber}: Drift (+{plot.maxBoundaryShiftMeters}m)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>{plot.plotNumber}: Encroachment (+{plot.maxBoundaryShiftMeters}m)</span>
                          </>
                        )}
                      </div>
                    </AdvancedMarker>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </Map>
      </APIProvider>

      {/* ==================================================== */}
      {/* MAP CONTROLS DOCK (BOTTOM-LEFT GIS DOCK)             */}
      {/* ==================================================== */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/70">
        {/* Basemap Switcher */}
        <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setMapTypeId("hybrid")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              mapTypeId === "hybrid"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Google Satellite imagery with street & boundary labels"
          >
            Satellite
          </button>

          <button
            onClick={() => setMapTypeId("satellite")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              mapTypeId === "satellite"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Pure Google Satellite orthophoto (no road labels)"
          >
            Aerial
          </button>

          <button
            onClick={() => setMapTypeId("roadmap")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              mapTypeId === "roadmap"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Vector
          </button>

          {onSwitchToLeaflet && (
            <button
              onClick={onSwitchToLeaflet}
              className="px-2 py-1 text-[10px] text-slate-400 hover:text-cyan-300 font-mono"
              title="Switch to Leaflet / Esri Basemap"
            >
              Esri
            </button>
          )}
        </div>

        <div className="w-[1px] h-5 bg-slate-800 mx-0.5" />

        {/* 3D Earth Tilt & Perspective Controls */}
        <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setTilt(tilt === 45 ? 0 : 45)}
            className={`px-2.5 py-1 rounded-lg font-bold font-mono transition flex items-center gap-1 ${
              tilt === 45
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Toggle 45° Google Earth 3D oblique perspective"
          >
            <Compass className="w-3 h-3 text-amber-400" />
            <span>{tilt === 45 ? "3D" : "2D"}</span>
          </button>

          <button
            onClick={() => setHeading((prev) => (prev + 90) % 360)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Rotate View 90° Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5 transform -scale-x-100" />
          </button>

          <button
            onClick={() => {
              setHeading(0);
              setTilt(0);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Reset North & 0° Tilt"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tamil Nadu Government Map Repositories Button */}
        {onOpenGovMapPanel && (
          <button
            onClick={onOpenGovMapPanel}
            className={`px-2.5 py-1 rounded-xl font-medium flex items-center gap-1 transition text-xs shadow-sm border ${
              activeGovLayout
                ? "bg-amber-600 text-white border-amber-500 ring-1 ring-amber-400/40"
                : "bg-slate-950/80 text-amber-300 hover:bg-slate-800 border-slate-800"
            }`}
            title="Tamil Nadu Government Map Repositories (FMB, CMDA, DTCP Layouts 1974-2026)"
          >
            <Landmark className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">{activeGovLayout ? activeGovLayout.approvalNo : "TN Gov Maps"}</span>
          </button>
        )}

        {selectedParcel && (
          <button
            onClick={handleRunMapsGrounding}
            disabled={isLoadingGrounding}
            className="px-2.5 py-1 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center gap-1 transition shadow-sm text-xs"
            title="Run Google Maps AI Grounding for selected parcel"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>{isLoadingGrounding ? "Grounding..." : "Maps AI"}</span>
          </button>
        )}
      </div>

      {/* Floating Surveyor Adjustment Bar (When Boundary Editing is Active) */}
      {isSurveyorEditing && selectedParcel && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border-2 border-amber-500/90 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto max-w-5xl">
          {/* Left: Parcel & Area Metrics */}
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              surveyTarget === "BUILDING"
                ? "bg-amber-500/20 border-amber-400/50 text-amber-400"
                : "bg-sky-500/20 border-sky-400/50 text-sky-400"
            }`}>
              {surveyTarget === "BUILDING" ? <Home className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-bold text-xs flex items-center gap-2">
                <span>{surveyTarget === "BUILDING" ? "Building Rooftop Alignment" : "Field Vertex Alignment Mode"}</span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/40">
                  {selectedParcel.uprn}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                  {Math.max(0, editableCoords.length - 1)} {surveyTarget === "BUILDING" ? "Corners" : "Pegs"}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                {surveyTarget === "BUILDING" ? (
                  <>
                    <span>
                      Roof Area: <strong className="text-amber-300 font-mono">{liveEditedArea.toFixed(1)} m²</strong>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span>
                      Record Built-up: <span className="font-mono">{(selectedParcel.buildingDetails?.builtUpAreaSqM || 0).toFixed(1)} m²</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Live Area: <strong className="text-white font-mono">{liveEditedArea.toFixed(1)} m²</strong>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span>
                      Original: <span className="font-mono">{selectedParcel.calculatedAreaSqMeters.toFixed(1)} m²</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className={liveEditedArea >= selectedParcel.calculatedAreaSqMeters ? "text-emerald-400" : "text-rose-400"}>
                      {liveEditedArea >= selectedParcel.calculatedAreaSqMeters ? "+" : ""}
                      {(liveEditedArea - selectedParcel.calculatedAreaSqMeters).toFixed(1)} m²
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mode Switcher: Plot Boundary vs Building Footprint */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
            <button
              onClick={() => setSurveyTarget("PARCEL")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                surveyTarget === "PARCEL"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Plot Boundary</span>
            </button>
            <button
              onClick={() => setSurveyTarget("BUILDING")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                surveyTarget === "BUILDING"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Building Footprint</span>
            </button>
          </div>

          <div className="hidden md:block w-[1px] h-8 bg-slate-800" />

          {/* Center: Snap-to-Grid & Adjacent Edge Snapping Controls */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {/* Primary Magnet Snap Toggle */}
              <button
                onClick={() =>
                  setSnapConfig((prev) => ({
                    ...prev,
                    mode: prev.mode === "OFF" ? "ALL" : "OFF",
                  }))
                }
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  snapConfig.mode !== "OFF"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm ring-1 ring-emerald-400/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
                title="Toggle Topological Edge & Grid Magnetic Snapping"
              >
                <Magnet className={`w-3.5 h-3.5 ${snapConfig.mode !== "OFF" ? "text-emerald-400 animate-pulse" : "text-slate-400"}`} />
                <span>Snap: {snapConfig.mode !== "OFF" ? "ON" : "OFF"}</span>
              </button>

              {/* Snap Mode Selector */}
              {snapConfig.mode !== "OFF" && (
                <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                  <button
                    onClick={() =>
                      setSnapConfig((prev) => ({
                        ...prev,
                        mode: "ALL",
                        gridResolutionMeters: 1.0,
                        enableEdgeSnapping: true,
                        enableGridSnapping: true,
                      }))
                    }
                    className={`px-2 py-1 rounded transition ${
                      snapConfig.mode === "ALL" && snapConfig.gridResolutionMeters === 1.0
                        ? "bg-emerald-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Snap to adjacent parcel edges, vertices, and 1m survey grid"
                  >
                    Edges + 1m Grid
                  </button>
                  <button
                    onClick={() =>
                      setSnapConfig((prev) => ({
                        ...prev,
                        mode: "EDGES_AND_VERTICES",
                        enableEdgeSnapping: true,
                        enableVertexSnapping: true,
                        enableGridSnapping: false,
                      }))
                    }
                    className={`px-2 py-1 rounded transition ${
                      snapConfig.mode === "EDGES_AND_VERTICES"
                        ? "bg-cyan-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Snap strictly to adjacent parcel boundaries (Zero Gap / Zero Overlap)"
                  >
                    Parcel Edges Only
                  </button>
                  <button
                    onClick={() =>
                      setSnapConfig((prev) => ({
                        ...prev,
                        mode: "ALL",
                        gridResolutionMeters: 0.5,
                        enableEdgeSnapping: true,
                        enableGridSnapping: true,
                      }))
                    }
                    className={`px-2 py-1 rounded transition ${
                      snapConfig.mode === "ALL" && snapConfig.gridResolutionMeters === 0.5
                        ? "bg-amber-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="High-precision 0.5m survey grid alignment"
                  >
                    0.5m Grid
                  </button>
                </div>
              )}

              {/* Add Midpoint Peg Button */}
              <button
                onClick={handleAddMidpointPeg}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition"
                title="Insert a midpoint vertex peg between Peg 1 and Peg 2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Peg</span>
              </button>

              {/* Revert Changes */}
              <button
                onClick={handleRevertBoundary}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
                title="Reset pegs to original survey boundaries"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live Snap Status Readout */}
            <div className="text-[10px] flex items-center gap-1.5 font-mono">
              {activeSnapResult?.isSnapped ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1 animate-pulse">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{activeSnapResult.description}</span>
                  <span className="text-slate-400 font-normal border-l border-slate-700 pl-1">
                    {activeSnapResult.topologicalBenefit}
                  </span>
                </span>
              ) : snapConfig.mode !== "OFF" ? (
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Magnetic Snapping Active: Boundaries automatically lock to adjacent parcel edges</span>
                </span>
              ) : (
                <span className="text-amber-400/80">Snapping disabled (Free drag mode)</span>
              )}
            </div>
          </div>

          {/* Topological QC Integrity Status Indicator */}
          {liveTopologyValidation && (
            <>
              <div className="hidden lg:block w-[1px] h-8 bg-slate-800" />
              <div className="flex items-center gap-2">
                {!liveTopologyValidation.isValid ? (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs shadow-lg animate-pulse"
                    title={liveTopologyValidation.summaryMessage}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-bold text-rose-300 text-[11px]">
                        <span>QC VIOLATION</span>
                        <span className="text-[10px] font-mono bg-rose-500/30 text-rose-200 px-1 rounded border border-rose-500/40">
                          {liveTopologyValidation.violatingVertexIndices.size} peg{liveTopologyValidation.violatingVertexIndices.size > 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-[10px] text-rose-300/90 leading-tight truncate max-w-[210px]">
                        {liveTopologyValidation.summaryMessage}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-emerald-300">Topology Valid</span>
                      <span className="text-[9px] text-emerald-400/80 font-mono">0 Bowties • 0 Overlaps</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="hidden md:block w-[1px] h-8 bg-slate-800" />

          {/* Right: Commit and Cancel Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancelSurveyorAdjustment}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (liveTopologyValidation && !liveTopologyValidation.isValid) {
                  const proceed = window.confirm(
                    `⚠️ TOPOLOGICAL QUALITY CONTROL WARNING:\n\n${liveTopologyValidation.summaryMessage}\n\nCommitting will store a self-intersecting or overlapping boundary in the cadastral ledger. Do you still wish to force commit this ground truth?`
                  );
                  if (!proceed) return;
                }
                onSaveSurveyorAdjustment(editableCoords, surveyTarget);
              }}
              className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition ${
                liveTopologyValidation && !liveTopologyValidation.isValid
                  ? "bg-rose-700 hover:bg-rose-600 ring-2 ring-rose-500/60"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
              title={
                liveTopologyValidation && !liveTopologyValidation.isValid
                  ? `Warning: ${liveTopologyValidation.summaryMessage}`
                  : "Commit validated boundary to surveyor ledger"
              }
            >
              {liveTopologyValidation && !liveTopologyValidation.isValid ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
                  <span>Commit ({liveTopologyValidation.violatingVertexIndices.size} QC Alert{liveTopologyValidation.violatingVertexIndices.size > 1 ? "s" : ""})</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Commit Ground Truth</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Tape Measure Result Pill */}
      {measuringMode && measurePoints.length > 1 && (
        <div className="absolute bottom-6 left-20 z-20 bg-slate-900/90 border border-teal-500/70 text-teal-200 px-3.5 py-2 rounded-xl shadow-xl text-xs backdrop-blur-md flex items-center gap-3 pointer-events-auto">
          <Ruler className="w-4 h-4 text-teal-400 shrink-0" />
          <div>
            <div className="font-bold text-white text-[11px]">Tape Measure Active</div>
            <div className="text-[10px] text-teal-300 font-mono">
              Points: {measurePoints.length} • Click more pegs on satellite buildings/fences
            </div>
          </div>
          <button
            onClick={() => setMeasurePoints([])}
            className="text-[10px] text-slate-400 hover:text-white underline ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Maps Grounding AI Insight Modal / Drawer */}
      {groundingInsight && (
        <div className="absolute bottom-20 right-6 z-30 bg-slate-900/95 border border-indigo-500/80 text-slate-200 p-4 rounded-2xl shadow-2xl max-w-md max-h-72 overflow-y-auto backdrop-blur-md text-xs pointer-events-auto animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Google Maps Spatial Grounding Insight</span>
            </div>
            <button
              onClick={() => setGroundingInsight(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <div className="whitespace-pre-line text-slate-300 leading-relaxed font-sans text-[11px]">
            {groundingInsight}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 1967 FMB G-LINE LADDER BOOK TABLE MODAL                   */}
      {/* ========================================================== */}
      {showLadderTable && historicalFmbDataset && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl max-w-2xl w-full p-5 text-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Official 1967 FMB G-Line Field Measurement Book (Ladder Record)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tamil Nadu Survey & Land Records Dept • Survey No. {historicalFmbDataset.surveyNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLadderTable(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Baseline Specs */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs mb-4">
              <div>
                <span className="text-slate-500">G-Line Length:</span>
                <span className="font-mono text-amber-300 font-bold ml-1.5">
                  {historicalFmbDataset.gLine.lengthMeters} m
                </span>
              </div>
              <div>
                <span className="text-slate-500">Magnetic Azimuth:</span>
                <span className="font-mono text-sky-300 font-bold ml-1.5">
                  {historicalFmbDataset.gLine.azimuthDeg}°
                </span>
              </div>
              <div>
                <span className="text-slate-500">Datum Tri-junctions:</span>
                <span className="font-mono text-emerald-300 font-bold ml-1.5">S1 to S2</span>
              </div>
            </div>

            {/* Classical Ladder Book Layout */}
            <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800 text-slate-300 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5 border-b border-slate-700">Offset Left (m)</th>
                    <th className="p-2.5 border-b border-slate-700 bg-amber-950/40 text-amber-300 text-center font-bold">
                      Chainage along G-Line (m)
                    </th>
                    <th className="p-2.5 border-b border-slate-700 text-right">Offset Right (m)</th>
                    <th className="p-2.5 border-b border-slate-700">Station / Target Corner</th>
                    <th className="p-2.5 border-b border-slate-700">2026 Ground Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {historicalFmbDataset.gLine.ladderStations.map((station, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="p-2.5 text-sky-400">
                        {station.offsetLeftMeters > 0 ? `${station.offsetLeftMeters.toFixed(1)}m` : "—"}
                      </td>
                      <td className="p-2.5 bg-amber-950/20 text-amber-300 font-bold text-center">
                        {station.chainage.toFixed(1)}m
                      </td>
                      <td className="p-2.5 text-right text-indigo-400">
                        {station.offsetRightMeters > 0 ? `${station.offsetRightMeters.toFixed(1)}m` : "—"}
                      </td>
                      <td className="p-2.5 font-sans font-medium text-slate-200">
                        {station.label}
                      </td>
                      <td className="p-2.5 font-sans">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 border border-emerald-600 text-emerald-300">
                          {station.groundVerified2026 ? "Peg Verified" : "Peg Drifted"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">
                Formulated per Tamil Nadu Survey Manual (Vol I & II) & Land Administration Standards.
              </span>
              <button
                onClick={() => setShowLadderTable(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
