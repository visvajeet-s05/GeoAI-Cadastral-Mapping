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
  measuringMode: boolean;
  onMapClick: (latLng: google.maps.LatLngLiteral) => void;
  onBoundsChange?: (bounds: [number, number, number, number]) => void;
}

const MapController: React.FC<MapControllerProps> = ({
  selectedParcel,
  measuringMode,
  onMapClick,
  onBoundsChange,
}) => {
  const map = useMap();

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

  // Fly to selected parcel
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
  onSaveSurveyorAdjustment: (updatedCoordinates: [number, number][]) => void;
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

  // Initialize editable coordinates when parcel editing begins
  useEffect(() => {
    if (selectedParcel && isSurveyorEditing) {
      setEditableCoords([...selectedParcel.coordinates]);
    } else {
      setEditableCoords([]);
    }
  }, [selectedParcel, isSurveyorEditing]);

  // Handle vertex peg drag during surveyor boundary adjustment
  const handleVertexDrag = (index: number, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();

    setEditableCoords((prev) => {
      const updated = [...prev];
      updated[index] = [newLng, newLat];
      // If closing ring (first === last), keep both in sync
      if (index === 0 && updated.length > 1) {
        updated[updated.length - 1] = [newLng, newLat];
      } else if (index === updated.length - 1 && updated.length > 1) {
        updated[0] = [newLng, newLat];
      }
      return updated;
    });
  };

  // Calculate live area during surveyor editing
  const liveEditedArea = useMemo(() => {
    if (editableCoords.length < 3) return 0;
    return calculateShoelaceArea(editableCoords);
  }, [editableCoords]);

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

  // Default cluster center
  const defaultCenter = { lat: 28.6143, lng: 77.2095 };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      <APIProvider apiKey={apiKey} libraries={["places", "marker", "geometry"]}>
        {/* Main Google Maps View */}
        <Map
          mapId={mapId || "DEMO_MAP_ID"}
          defaultCenter={defaultCenter}
          defaultZoom={17}
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
            measuringMode={measuringMode}
            onMapClick={(pt) => setMeasurePoints((prev) => [...prev, pt])}
            onBoundsChange={onMapBoundsChange}
          />

          {/* Render All Cadastral Parcels */}
          {displayedParcels.map((parcel) => {
            const isSelected = selectedParcel?.id === parcel.id;
            const isEditingThis = isSelected && isSurveyorEditing && editableCoords.length > 0;

            const coordsToRender = isEditingThis ? editableCoords : parcel.coordinates;
            const latLngPaths = coordsToRender.map(([lng, lat]) => ({ lat, lng }));

            // Layer-based coloring - Thin Cadastral Boundaries (No giant opaque blocks)
            let fillColor = "#0284c7"; // Sky blue default
            let strokeColor = "#38bdf8";
            let fillOpacity = isSelected ? 0.12 : 0.04;
            let strokeWeight = isSelected ? 2.5 : 1.5;

            if (showHousePerceptionOverlay) {
              if (parcel.structureCount > 0) {
                // House / Built-up
                fillColor = "#0284c7";
                strokeColor = "#38bdf8";
                fillOpacity = isSelected ? 0.12 : 0.04;
              } else {
                // Vacant Land
                fillColor = "#10b981";
                strokeColor = "#34d399";
                fillOpacity = isSelected ? 0.12 : 0.04;
              }
            } else if (activeLayers.uncertaintyBands) {
              const uColor = getUncertaintyColor(parcel.overallUncertainty);
              fillColor = uColor.hex;
              strokeColor = uColor.hex;
              fillOpacity = 0.15;
            } else if (activeLayers.zoningColors) {
              const zColor = getLandTypeColor(parcel.landType);
              fillColor = zColor.fill;
              strokeColor = zColor.stroke;
              fillOpacity = 0.12;
            }

            if (activeLayers.topologyIssues && parcel.encroachmentDetected) {
              fillColor = "#ef4444";
              strokeColor = "#dc2626";
              fillOpacity = 0.18;
              strokeWeight = 2.5;
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
                  zIndex={isSelected ? 10 : 2}
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

                {/* Parcel Centroid Tag & House/Vacant Status Badge */}
                {activeLayers.vectorBoundaries && (
                  <AdvancedMarker
                    position={{
                      lat: pCentroidLat,
                      lng: pCentroidLng,
                    }}
                    zIndex={isSelected ? 30 : 5}
                  >
                    <div
                      onClick={() => onSelectParcel(parcel)}
                      className={`cursor-pointer px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold shadow-lg border flex items-center gap-1 transition-all hover:scale-110 whitespace-nowrap backdrop-blur-md ${
                        isSelected
                          ? "bg-sky-600 text-white border-sky-300 ring-2 ring-sky-400/50 scale-105"
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
                        {parcel.uprn.split("-").pop() || parcel.uprn}
                      </span>
                      {isSelected && (
                        <span className="text-[8px] text-slate-200 border-l border-sky-400/50 pl-1">
                          {Math.round(parcel.calculatedAreaSqMeters)}m²
                        </span>
                      )}
                      {parcel.encroachmentDetected && (
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0 animate-pulse" />
                      )}
                    </div>
                  </AdvancedMarker>
                )}
              </React.Fragment>
            );
          })}

          {/* Real AI-Detected Physical Objects (Individual Buildings, Open Areas, Roads) */}
          {activeLayers.structuralFootprints &&
            detections.map((det) => {
              const isDetSelected = selectedDetection?.id === det.id;
              const isDispute = det.multiParcelCrossing || det.status === "DISPUTED";
              const isBuilding = det.type === "BUILDING";

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
                    fillOpacity={isDetSelected ? 0.35 : isDispute ? 0.25 : 0.18}
                    strokeColor={detStroke}
                    strokeWeight={isDetSelected ? 2.8 : 1.8}
                    zIndex={isDetSelected ? 35 : 15}
                    onClick={() => {
                      onSelectDetection?.(det);
                      if (det.linkedParcelId) {
                        const linked = parcels.find((p) => p.id === det.linkedParcelId);
                        if (linked) onSelectParcel(linked);
                      }
                    }}
                  />

                  {/* Detection Label Pin */}
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
                          ? "bg-sky-600 text-white border-sky-300 ring-2 ring-sky-400/50"
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

          {/* Surveyor Interactive Vertex Editing Draggable Markers */}
          {isSurveyorEditing &&
            selectedParcel &&
            editableCoords.map(([lng, lat], idx) => {
              if (idx === editableCoords.length - 1 && editableCoords.length > 1) {
                return null; // Skip redundant closing node
              }
              return (
                <AdvancedMarker
                  key={`edit-peg-${idx}`}
                  position={{ lat, lng }}
                  draggable={true}
                  onDrag={(e) => handleVertexDrag(idx, e)}
                  zIndex={100}
                >
                  <div className="group relative -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing">
                    <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-slate-950 shadow-2xl flex items-center justify-center font-mono text-[9px] font-bold text-slate-950 ring-4 ring-amber-400/40">
                      {idx + 1}
                    </div>
                    <div className="absolute left-6 top-0 hidden group-hover:block bg-slate-900 border border-slate-700 text-amber-300 text-[9px] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                      Drag to realign with satellite roof/fence
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}

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

                  {/* Telemetry Tag */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-sky-500 text-sky-300 text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap">
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

                    {/* Official Legal Plot / Road Reserve Tag */}
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
      {/* FLOATING OVERLAYS & HUD CONTROLS OVER GOOGLE SATELLITE */}
      {/* ==================================================== */}

      {/* Top Left: Real-Time Places Search & House/Vacant Filter */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2 max-w-sm sm:max-w-md pointer-events-auto">
        {/* Search Bar */}
        <form
          onSubmit={handleSearchAddress}
          className="flex items-center bg-slate-900/95 border border-slate-700/90 rounded-xl shadow-2xl p-1 backdrop-blur-md"
        >
          <Search className="w-4 h-4 text-sky-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Search address, village, or coordinates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-white px-2 py-1.5 flex-1 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            {isSearching ? "Locating..." : "Locate"}
          </button>
        </form>

        {searchFeedback && (
          <div className="px-3 py-1.5 rounded-lg bg-sky-950/90 border border-sky-700 text-sky-200 text-[11px] shadow-lg flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{searchFeedback}</span>
          </div>
        )}

        {/* Real-time House vs Vacant Land Perception Strip */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 backdrop-blur-md text-[11px] shadow-lg">
          <button
            onClick={() => setLandFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              landFilter === "ALL"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>All Lots ({parcels.length})</span>
          </button>

          <button
            onClick={() => setLandFilter("HOUSES")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              landFilter === "HOUSES"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-amber-400/80 hover:text-amber-300"
            }`}
            title="Filter to lots with detected houses/structures"
          >
            <Home className="w-3 h-3" />
            <span>Houses ({parcels.filter((p) => p.structureCount > 0).length})</span>
          </button>

          <button
            onClick={() => setLandFilter("VACANT")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              landFilter === "VACANT"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-emerald-400/80 hover:text-emerald-300"
            }`}
            title="Filter to vacant lands & open plots"
          >
            <Trees className="w-3 h-3" />
            <span>Vacant ({parcels.filter((p) => p.structureCount === 0).length})</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

          {/* Toggle Perception Highlights */}
          <button
            onClick={() => setShowHousePerceptionOverlay((prev) => !prev)}
            className={`p-1 rounded-lg transition ${
              showHousePerceptionOverlay
                ? "text-sky-400 bg-sky-500/10"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle House (Amber) vs Vacant Land (Green) Satellite Highlights"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Right: Unified Cadastral Map Control Deck */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 ring-1 ring-white/5">
          {/* Tier 1: View Modes & Perspective */}
          <div className="flex items-center gap-1">
            {/* Basemap Switcher */}
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setMapTypeId("hybrid")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  mapTypeId === "hybrid"
                    ? "bg-sky-600 text-white shadow-sm"
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
                    ? "bg-sky-600 text-white shadow-sm"
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
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Vector
              </button>

              {onSwitchToLeaflet && (
                <button
                  onClick={onSwitchToLeaflet}
                  className="px-2 py-1 text-[10px] text-slate-400 hover:text-sky-300 font-mono"
                  title="Switch to Leaflet / Esri Basemap"
                >
                  Esri
                </button>
              )}
            </div>

            <div className="w-[1px] h-5 bg-slate-800 mx-0.5" />

            {/* 3D Oblique Earth Tilt & Perspective Controls */}
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
          </div>

          {/* Tier 2: Spatial Tools & Overlays */}
          <div className="flex items-center gap-1 justify-end text-xs">
            <button
              onClick={() => {
                setMeasuringMode((prev) => !prev);
                if (measuringMode) setMeasurePoints([]);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition ${
                measuringMode
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-950/80 text-teal-300 hover:bg-slate-800 border border-slate-800"
              }`}
              title="Tape Measure Tool: Click on satellite roofs or borders to measure real distance"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>{measuringMode ? "Measuring..." : "Measure"}</span>
            </button>

            {/* Tamil Nadu Government Map Repositories Button */}
            {onOpenGovMapPanel && (
              <button
                onClick={onOpenGovMapPanel}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition text-xs shadow-sm border ${
                  activeGovLayout
                    ? "bg-amber-600 text-white border-amber-500 ring-1 ring-amber-400/40"
                    : "bg-slate-950/80 text-amber-300 hover:bg-slate-800 border-slate-800"
                }`}
                title="Tamil Nadu Government Map Repositories (FMB, CMDA, DTCP Layouts 1974-2026)"
              >
                <Landmark className="w-3.5 h-3.5 text-amber-300" />
                <span>{activeGovLayout ? activeGovLayout.approvalNo : "TN Gov Maps"}</span>
              </button>
            )}

            {selectedParcel && (
              <button
                onClick={handleRunMapsGrounding}
                disabled={isLoadingGrounding}
                className="px-2.5 py-1 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-1 transition shadow-sm"
                title="Run Google Maps AI Grounding for selected parcel"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{isLoadingGrounding ? "Grounding..." : "Maps AI"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Surveyor Adjustment Bar (When Boundary Editing is Active) */}
      {isSurveyorEditing && selectedParcel && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[450] bg-slate-900/95 border-2 border-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs flex items-center gap-2">
                <span>Aligning Pegs over Satellite Imagery</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                  {selectedParcel.uprn}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>
                  Adjusted Area: <strong className="text-white font-mono">{liveEditedArea.toFixed(1)} m²</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span>
                  Original: <span className="font-mono">{selectedParcel.calculatedAreaSqMeters.toFixed(1)} m²</span>
                </span>
                <span className="text-slate-500">•</span>
                <span className={liveEditedArea >= selectedParcel.calculatedAreaSqMeters ? "text-emerald-400" : "text-rose-400"}>
                  {liveEditedArea >= selectedParcel.calculatedAreaSqMeters ? "+" : ""}
                  {(liveEditedArea - selectedParcel.calculatedAreaSqMeters).toFixed(1)} m²
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={onCancelSurveyorAdjustment}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onSaveSurveyorAdjustment(editableCoords)}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Commit Ground Truth</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Tape Measure Result Pill */}
      {measuringMode && measurePoints.length > 1 && (
        <div className="absolute bottom-6 left-6 z-[400] bg-slate-900/90 border border-teal-500/70 text-teal-200 px-3.5 py-2 rounded-xl shadow-xl text-xs backdrop-blur-md flex items-center gap-3 pointer-events-auto">
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
        <div className="absolute bottom-6 right-6 z-[450] bg-slate-900/95 border border-indigo-500/80 text-slate-200 p-4 rounded-2xl shadow-2xl max-w-md max-h-72 overflow-y-auto backdrop-blur-md text-xs pointer-events-auto animate-in fade-in slide-in-from-bottom-3">
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
      {/* 1967 - 2026 HISTORICAL FMB / FMDP TIMELINE & DETECT ALL BAR */}
      {/* ========================================================== */}
      {historicalFmbDataset && showHistoricalTimelineBar && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[450] bg-slate-900/95 border-2 border-amber-500/70 text-white rounded-2xl shadow-2xl backdrop-blur-md px-4 py-2.5 max-w-4xl w-[96%] md:w-auto pointer-events-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Title & Survey metadata */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-amber-300">FMB Multi-Temporal Verification</span>
                  <span className="text-[10px] font-mono bg-amber-950 px-1.5 py-0.5 rounded border border-amber-600 text-amber-200">
                    1967 — 2026
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700">
                    {historicalFmbDataset.congruenceIndexPercent}% Congruence
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {historicalFmbDataset.surveyNo} • {historicalFmbDataset.village}, {historicalFmbDataset.taluk} (8 Cadastral Plots)
                </div>
              </div>
            </div>

            {/* Central Action: DETECT ALL BUTTON */}
            <div className="flex items-center gap-2">
              <button
                id="btn-detect-all-plan"
                onClick={onTriggerDetectAll}
                disabled={isDetectingAll}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                title="Detect all discrepancies by checking if all 8 plots are equally sketched from 1967 to 2026"
              >
                {isDetectingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Detecting All 8 Plots...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                    <span>⚡ Detect All (1967–2026 FMB)</span>
                  </>
                )}
              </button>

              {/* Ladder Table Button */}
              <button
                onClick={() => setShowLadderTable(true)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                title="Open 1967 FMB G-Line Ladder Book Table"
              >
                <Table className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">FMB Ladder</span>
              </button>
            </div>
          </div>

          {/* Epoch Slider / Switcher */}
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" />
                Epoch:
              </span>
              <button
                onClick={() => setActiveEpoch("1967_FMB_SURVEY")}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeEpoch === "1967_FMB_SURVEY"
                    ? "bg-amber-600 text-white font-bold shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                📜 1967 Settlement FMB
              </button>
              <button
                onClick={() => setActiveEpoch("1985_SUBDIVISION")}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeEpoch === "1985_SUBDIVISION"
                    ? "bg-sky-600 text-white font-bold shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                📐 1985 Sub-Division
              </button>
              <button
                onClick={() => setActiveEpoch("2005_TSLR_DIGITAL")}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeEpoch === "2005_TSLR_DIGITAL"
                    ? "bg-indigo-600 text-white font-bold shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                💻 2005 TSLR Digital
              </button>
              <button
                onClick={() => setActiveEpoch("2026_SATELLITE_DETECTED")}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeEpoch === "2026_SATELLITE_DETECTED"
                    ? "bg-emerald-600 text-white font-bold shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                🛰️ 2026 Satellite
              </button>
              <button
                onClick={() => setActiveEpoch("ALL_EPOCHS_OVERLAY")}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeEpoch === "ALL_EPOCHS_OVERLAY"
                    ? "bg-gradient-to-r from-amber-600 via-sky-600 to-emerald-600 text-white font-bold shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                🔀 All Overlaid (Compare)
              </button>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/80">
                ✓ 5 Equally Sketched
              </span>
              <span className="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/80">
                ⚠️ 1 Mutation Drift
              </span>
              <span className="text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/80">
                🚨 2 Encroachments
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* PLOT CONGRUENCE INSPECTION CARD (When a plot is clicked) */}
      {/* ========================================================== */}
      {selectedPlotCongruence && (
        <div className="absolute top-28 right-6 z-[450] bg-slate-900/95 border-2 border-slate-700 text-slate-100 p-4 rounded-2xl shadow-2xl max-w-sm w-full backdrop-blur-md text-xs pointer-events-auto animate-in fade-in slide-in-from-right-4">
          <div className="flex items-start justify-between pb-2 border-b border-slate-800 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {selectedPlotCongruence.plotNumber}
                </span>
                <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-sky-300">
                  {selectedPlotCongruence.uprn}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Owner: <span className="text-slate-200 font-semibold">{selectedPlotCongruence.ownerName}</span>
              </div>
            </div>
            <button
              onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Close Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Congruence Status Pill */}
          <div
            className={`p-2.5 rounded-xl border mb-3 flex items-start gap-2 ${
              selectedPlotCongruence.equallySketched
                ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-200"
                : selectedPlotCongruence.driftType === "BOUNDARY_DRIFT"
                ? "bg-amber-950/80 border-amber-500/80 text-amber-200"
                : "bg-rose-950/80 border-rose-500/80 text-rose-200"
            }`}
          >
            {selectedPlotCongruence.equallySketched ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-xs">
                {selectedPlotCongruence.equallySketched
                  ? "✓ 100% Equally Sketched to FMB"
                  : selectedPlotCongruence.driftType === "BOUNDARY_DRIFT"
                  ? "⚠️ Mutation Boundary Drift"
                  : "🚨 Public Road Encroachment"}
              </div>
              <div className="text-[10px] opacity-90 mt-0.5">
                Shift: ±{selectedPlotCongruence.maxBoundaryShiftMeters}m (Tolerance: 0.25m)
              </div>
            </div>
          </div>

          {/* Comparative Multi-Epoch Area Evolution */}
          <div className="space-y-1.5 mb-3 bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Historical Epoch Evolution (1967 - 2026)
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">1967 FMB:</span>
                <span className="font-mono text-amber-300 ml-1.5 font-semibold">
                  {selectedPlotCongruence.area1967SqM} m²
                </span>
              </div>
              <div>
                <span className="text-slate-500">1985 Layout:</span>
                <span className="font-mono text-sky-300 ml-1.5 font-semibold">
                  {selectedPlotCongruence.area1985SqM} m²
                </span>
              </div>
              <div>
                <span className="text-slate-500">2005 TSLR:</span>
                <span className="font-mono text-indigo-300 ml-1.5 font-semibold">
                  {selectedPlotCongruence.area2005SqM} m²
                </span>
              </div>
              <div>
                <span className="text-slate-500">2026 Satellite:</span>
                <span className={`font-mono ml-1.5 font-bold ${
                  selectedPlotCongruence.equallySketched ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {selectedPlotCongruence.area2026SatelliteSqM} m²
                </span>
              </div>
            </div>
            {selectedPlotCongruence.areaVarianceSqM !== 0 && (
              <div className="pt-1.5 border-t border-slate-800 text-[10px] flex items-center justify-between">
                <span className="text-slate-400">Area Variance:</span>
                <span className="font-mono font-bold text-rose-400">
                  {selectedPlotCongruence.areaVarianceSqM > 0 ? "+" : ""}
                  {selectedPlotCongruence.areaVarianceSqM} m²
                </span>
              </div>
            )}
          </div>

          {/* Statutory Finding Remark */}
          <div className="text-[11px] text-slate-300 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 leading-relaxed mb-3">
            <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">
              Statutory Cadastral Finding
            </div>
            {selectedPlotCongruence.auditRemark}
          </div>

          {/* Close & Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onSelectPlotCongruence && onSelectPlotCongruence(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
            >
              Dismiss
            </button>
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
