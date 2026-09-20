import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Parcel,
  ActiveLayers,
  TopologyReport,
  UAVTelemetry,
  IngestionMode,
  GovLayoutRecord,
  EncroachmentDiscrepancy,
  FmbPlanHistoricalDataset,
  PlotCongruenceRecord,
} from "../types";
import {
  getLandTypeColor,
  getUncertaintyColor,
  calculateGeodesicDistanceMeters,
  calculateShoelaceArea,
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
  PlusCircle,
  Trash2,
  Globe,
} from "lucide-react";
import { GoogleCadastralMap } from "./GoogleCadastralMap";
import { DriftHotspot } from "../types";
import { AIDetectionItem } from "./LiveDroneSplitView";

interface MapViewProps {
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

export const MapView: React.FC<MapViewProps> = ({
  parcels,
  selectedParcel,
  onSelectParcel,
  activeLayers,
  topologyReport,
  isSurveyorEditing,
  onSaveSurveyorAdjustment,
  onCancelSurveyorAdjustment,
  telemetry,
  ingestionMode = "VIRTUAL_UAV",
  onMapBoundsChange,
  activeGovLayout,
  activeDiscrepancy,
  onOpenGovMapPanel,
  historicalFmbDataset,
  onTriggerDetectAll,
  isDetectingAll,
  selectedPlotCongruence,
  onSelectPlotCongruence,
  allDiscrepancies,
  driftHotspots,
  selectedDetection,
  onSelectDetection,
}) => {
  const [mapEngine, setMapEngine] = useState<"google" | "leaflet">("google");
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDTUnZ5kldw8c2ZseONnusTAwEoftoc8BM"
  );
  const [mapId, setMapId] = useState<string>(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"
  );

  useEffect(() => {
    fetch("/api/maps/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.apiKey) setMapsApiKey(d.apiKey);
        if (d.mapId) setMapId(d.mapId);
      })
      .catch(() => {});
  }, []);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const footprintLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const editableMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const editablePolygonRef = useRef<L.Polygon | null>(null);
  const measureLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const uavLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const flightTrailRef = useRef<[number, number][]>([]);

  const [editableCoords, setEditableCoords] = useState<[number, number][]>([]);
  const [measuringMode, setMeasuringMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

  // Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center around New Delhi cadastral cluster
    const map = L.map(mapContainerRef.current, {
      center: [28.6143, 77.2095],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    // Default basemap: Esri World Imagery (Satellite)
    const baseLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 20,
        attribution: "Esri World Imagery",
      }
    ).addTo(map);

    tileLayerRef.current = baseLayer;

    // Layer groups for dynamic rendering
    const polyGroup = L.layerGroup().addTo(map);
    const footprintGroup = L.layerGroup().addTo(map);
    const editGroup = L.layerGroup().addTo(map);
    const measureGroup = L.layerGroup().addTo(map);
    const uavGroup = L.layerGroup().addTo(map);

    polygonLayerGroupRef.current = polyGroup;
    footprintLayerGroupRef.current = footprintGroup;
    editableMarkersGroupRef.current = editGroup;
    measureLayerGroupRef.current = measureGroup;
    uavLayerGroupRef.current = uavGroup;

    // Listen to map viewport changes for satellite bbox sync
    map.on("moveend", () => {
      const b = map.getBounds();
      onMapBoundsChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });

    // Initial bounds
    const initBounds = map.getBounds();
    onMapBoundsChange?.([initBounds.getWest(), initBounds.getSouth(), initBounds.getEast(), initBounds.getNorth()]);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync coords ref for smooth dragging without re-mounting
  const coordsRef = useRef<[number, number][]>([]);
  useEffect(() => {
    coordsRef.current = editableCoords;
  }, [editableCoords]);

  // Click handler for Cadastral Tape Measure Tool
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (measuringMode) {
        setMeasurePoints((prev) => [...prev, [e.latlng.lng, e.latlng.lat]]);
      }
    };

    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [measuringMode]);

  // Render Measuring Graphics (Pegs, Distance Lines, Area)
  useEffect(() => {
    const measureGroup = measureLayerGroupRef.current;
    if (!measureGroup) return;

    measureGroup.clearLayers();
    if (!measuringMode || measurePoints.length === 0) return;

    const latLngs: L.LatLngExpression[] = measurePoints.map(([lng, lat]) => [lat, lng]);

    // Draw lines between points
    if (measurePoints.length > 1) {
      const line = L.polyline(latLngs, {
        color: "#38bdf8",
        weight: 2.5,
        dashArray: "6, 6",
      });
      measureGroup.addLayer(line);

      // Measure segment distances
      for (let i = 0; i < measurePoints.length - 1; i++) {
        const p1 = measurePoints[i];
        const p2 = measurePoints[i + 1];
        const dist = calculateGeodesicDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
        const midLat = (p1[1] + p2[1]) / 2;
        const midLng = (p1[0] + p2[0]) / 2;

        const label = L.divIcon({
          className: "measure-dist-label",
          html: `<div class="px-1.5 py-0.5 rounded bg-slate-900/90 text-sky-300 font-mono text-[10px] font-bold border border-sky-500/50 shadow whitespace-nowrap">${dist.toFixed(1)}m</div>`,
          iconSize: [48, 18],
          iconAnchor: [24, 9],
        });
        measureGroup.addLayer(L.marker([midLat, midLng], { icon: label, interactive: false }));
      }
    }

    // Draw enclosed polygon if 3+ points
    if (measurePoints.length >= 3) {
      const poly = L.polygon(latLngs, {
        color: "#0284c7",
        weight: 1.5,
        fillColor: "#38bdf8",
        fillOpacity: 0.25,
      });
      measureGroup.addLayer(poly);
    }

    // Draw peg markers
    measurePoints.forEach(([lng, lat], idx) => {
      const pegIcon = L.divIcon({
        className: "measure-peg-marker",
        html: `<div class="w-5 h-5 rounded-full bg-sky-500 border-2 border-white shadow-lg flex items-center justify-center text-[9px] font-bold text-slate-950">${idx + 1}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      measureGroup.addLayer(L.marker([lat, lng], { icon: pegIcon }));
    });
  }, [measuringMode, measurePoints]);

  // Update Basemap when activeLayers.satelliteBasemap changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let newTileLayer: L.TileLayer;
    if (activeLayers.satelliteBasemap) {
      newTileLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20 }
      );
    } else {
      newTileLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19 }
      );
    }

    newTileLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
  }, [activeLayers.satelliteBasemap]);

  // Sync Editable Coordinates when selectedParcel or isSurveyorEditing changes
  useEffect(() => {
    if (selectedParcel && isSurveyorEditing) {
      setEditableCoords([...selectedParcel.coordinates]);
    } else {
      setEditableCoords([]);
    }
  }, [selectedParcel, isSurveyorEditing]);

  // Render Polygons and Footprints
  useEffect(() => {
    const map = mapInstanceRef.current;
    const polyGroup = polygonLayerGroupRef.current;
    const footprintGroup = footprintLayerGroupRef.current;
    const editGroup = editableMarkersGroupRef.current;

    if (!map || !polyGroup || !footprintGroup || !editGroup) return;

    polyGroup.clearLayers();
    footprintGroup.clearLayers();
    editGroup.clearLayers();

    if (parcels.length === 0) return;

    parcels.forEach((parcel) => {
      const isSelected = selectedParcel?.id === parcel.id;
      const coords =
        isSelected && isSurveyorEditing && editableCoords.length > 0
          ? editableCoords
          : parcel.coordinates;

      // Leaflet requires [lat, lng] format while GeoJSON uses [lng, lat]
      const latLngs: L.LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);

      // Styling based on active layer toggles
      let fillColor = "#3B82F6";
      let strokeColor = "#2563EB";
      let fillOpacity = isSelected ? 0.45 : 0.25;
      let weight = isSelected ? 3.5 : 2;

      if (activeLayers.uncertaintyBands) {
        const uColor = getUncertaintyColor(parcel.overallUncertainty);
        fillColor = uColor.hex;
        strokeColor = uColor.hex;
        fillOpacity = 0.4;
      } else if (activeLayers.zoningColors) {
        const zColor = getLandTypeColor(parcel.landType);
        fillColor = zColor.fill;
        strokeColor = zColor.stroke;
      }

      if (activeLayers.topologyIssues && parcel.encroachmentDetected) {
        fillColor = "#EF4444";
        strokeColor = "#DC2626";
        fillOpacity = 0.55;
        weight = 3.5;
      }

      // Main Parcel Polygon
      const polygon = L.polygon(latLngs, {
        color: strokeColor,
        weight: weight,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        dashArray: isSelected ? "4, 4" : undefined,
      });

      if (isSelected && isSurveyorEditing) {
        editablePolygonRef.current = polygon;
      }

      polygon.on("click", () => {
        onSelectParcel(parcel);
      });

      // Hover tooltip
      polygon.bindTooltip(
        `
        <div class="font-sans text-xs p-1">
          <div class="font-bold text-slate-900">${parcel.uprn}</div>
          <div class="text-slate-600">${parcel.ownerName}</div>
          <div class="text-sky-700 font-semibold mt-0.5">${parcel.calculatedAreaSqMeters.toLocaleString()} m²</div>
          ${
            parcel.encroachmentDetected
              ? '<span class="text-rose-600 font-bold">⚠️ Encroachment Flagged</span>'
              : ""
          }
        </div>
      `,
        { sticky: true, className: "cadastral-tooltip" }
      );

      polyGroup.addLayer(polygon);

      // Centroid label badge (GeoTrace-AI parcel identifier)
      if (activeLayers.vectorBoundaries) {
        const labelIcon = L.divIcon({
          className: "custom-parcel-label",
          html: `
            <div class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-sm border border-slate-700/60 ${
              isSelected
                ? "bg-sky-500 text-white border-sky-300 ring-2 ring-sky-300/50"
                : "bg-slate-900/80 text-slate-200"
            }">
              ${parcel.uprn.split("-").pop() || parcel.uprn} • ${Math.round(
            parcel.calculatedAreaSqMeters
          )}m²
            </div>
          `,
          iconSize: [80, 20],
          iconAnchor: [40, 10],
        });

        const marker = L.marker(
          [parcel.centroid.latitude, parcel.centroid.longitude],
          { icon: labelIcon, interactive: false }
        );
        polyGroup.addLayer(marker);
      }

      // Building Footprints Layer (YOLOv8 Segmentation simulation)
      if (activeLayers.structuralFootprints && parcel.structureCount > 0) {
        const centroidLat = parcel.centroid.latitude;
        const centroidLon = parcel.centroid.longitude;

        // Simulate building footprint slightly smaller than parcel centroid
        const buildingOffset = 0.00008;
        const buildingLatLngs: L.LatLngExpression[] = [
          [centroidLat - buildingOffset, centroidLon - buildingOffset],
          [centroidLat + buildingOffset, centroidLon - buildingOffset],
          [centroidLat + buildingOffset, centroidLon + buildingOffset],
          [centroidLat - buildingOffset, centroidLon + buildingOffset],
        ];

        const buildingPoly = L.polygon(buildingLatLngs, {
          color: "#475569",
          weight: 1.5,
          fillColor: "#334155",
          fillOpacity: 0.75,
        });

        buildingPoly.bindTooltip("Building Footprint (YOLOv8 Structural Segment)");
        footprintGroup.addLayer(buildingPoly);
      }
    });

    // Render Editable Vertex Handles if in Surveyor Mode
    if (isSurveyorEditing && selectedParcel && editableCoords.length > 0) {
      editableCoords.forEach(([lng, lat], index) => {
        const vertexIcon = L.divIcon({
          className: "surveyor-vertex-handle",
          html: `
            <div class="w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-900 shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center text-[8px] font-bold text-slate-900">
              ${index + 1}
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const vertexMarker = L.marker([lat, lng], {
          icon: vertexIcon,
          draggable: true,
        });

        vertexMarker.on("drag", (e: any) => {
          const newLatLng = e.target.getLatLng();
          const current = [...coordsRef.current];
          current[index] = [newLatLng.lng, newLatLng.lat];
          if (index === 0 && current.length > 1) {
            current[current.length - 1] = [newLatLng.lng, newLatLng.lat];
          } else if (index === current.length - 1 && current.length > 1) {
            current[0] = [newLatLng.lng, newLatLng.lat];
          }
          coordsRef.current = current;
          if (editablePolygonRef.current) {
            editablePolygonRef.current.setLatLngs(current.map(([cLng, cLat]) => [cLat, cLng]));
          }
        });

        vertexMarker.on("dragend", () => {
          setEditableCoords([...coordsRef.current]);
        });

        editGroup.addLayer(vertexMarker);
      });
    }
  }, [
    parcels,
    selectedParcel?.id,
    activeLayers,
    isSurveyorEditing,
    editableCoords.length,
    onSelectParcel,
  ]);

  // Render Virtual UAV flight trail, camera footprint, and drone symbol
  useEffect(() => {
    const map = mapInstanceRef.current;
    const uavGroup = uavLayerGroupRef.current;
    if (!map || !uavGroup) return;

    uavGroup.clearLayers();

    if (!telemetry || ingestionMode !== "VIRTUAL_UAV") {
      return;
    }

    const { latitude, longitude, heading_deg, altitude_agl, gsd_cm_px, camera_footprint_bbox } = telemetry;

    // Track flight path
    const trail = flightTrailRef.current;
    trail.push([latitude, longitude]);
    if (trail.length > 80) trail.shift();

    // 1. Draw flight trail polyline
    if (trail.length > 1) {
      const trailPoly = L.polyline(trail, {
        color: "#38bdf8",
        weight: 2,
        opacity: 0.6,
        dashArray: "4, 6",
      });
      uavGroup.addLayer(trailPoly);
    }

    // 2. Draw Camera FOV Footprint Polygon
    if (camera_footprint_bbox && camera_footprint_bbox.length >= 4) {
      const footprintLatLngs: L.LatLngExpression[] = camera_footprint_bbox.map(
        ([lon, lat]) => [lat, lon] as [number, number]
      );
      const footprintPoly = L.polygon(footprintLatLngs, {
        color: "#06b6d4",
        weight: 1.5,
        dashArray: "6, 4",
        fillColor: "#22d3ee",
        fillOpacity: 0.12,
      });
      footprintPoly.bindTooltip(
        `UAV Sensor FOV (GSD: ${gsd_cm_px} cm/px | Alt: ${altitude_agl}m)`,
        { direction: "top", offset: [0, -10] }
      );
      uavGroup.addLayer(footprintPoly);
    }

    // 3. Draw Rotating Drone Marker
    const droneSvg = `
      <div style="transform: rotate(${heading_deg}deg); transition: transform 0.3s ease-out; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.9));">
          <path d="M12 2L15 9H9L12 2Z" fill="#38bdf8" />
          <path d="M12 2v20" />
          <path d="M2 12h20" />
          <circle cx="4" cy="12" r="2.5" fill="#0284c7" stroke="#38bdf8" />
          <circle cx="20" cy="12" r="2.5" fill="#0284c7" stroke="#38bdf8" />
          <circle cx="12" cy="4" r="2.5" fill="#0284c7" stroke="#38bdf8" />
          <circle cx="12" cy="20" r="2.5" fill="#0284c7" stroke="#38bdf8" />
          <circle cx="12" cy="12" r="3" fill="#0369a1" />
        </svg>
      </div>
    `;

    const uavIcon = L.divIcon({
      className: "uav-live-marker",
      html: droneSvg,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const droneMarker = L.marker([latitude, longitude], {
      icon: uavIcon,
      zIndexOffset: 1000,
    });

    droneMarker.bindTooltip(
      `<strong>Virtual UAV (RTK FIXED)</strong><br/>Alt: ${altitude_agl}m | GSD: ${gsd_cm_px} cm/px<br/>Heading: ${Math.round(heading_deg)}°`,
      { direction: "top", offset: [0, -18] }
    );

    uavGroup.addLayer(droneMarker);
  }, [telemetry, ingestionMode]);

  // Center map on selected parcel
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedParcel) return;
    mapInstanceRef.current.flyTo(
      [selectedParcel.centroid.latitude, selectedParcel.centroid.longitude],
      18,
      { duration: 0.8 }
    );
  }, [selectedParcel?.id]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitBounds = () => {
    if (!mapInstanceRef.current || parcels.length === 0) return;
    const allCoords: L.LatLngExpression[] = parcels.flatMap((p) =>
      p.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
    );
    const bounds = L.latLngBounds(allCoords);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
  };

  // Distance & Area Calculation for Active Measuring Mode
  const totalMeasureDistance = measurePoints.reduce((sum, pt, idx) => {
    if (idx === 0) return 0;
    const prev = measurePoints[idx - 1];
    return sum + calculateGeodesicDistanceMeters(prev[1], prev[0], pt[1], pt[0]);
  }, 0);

  const measureArea = measurePoints.length >= 3 ? calculateShoelaceArea(measurePoints) : 0;

  // Insert a midpoint vertex between peg 1 and peg 2 for boundary refinement
  const handleAddMidpointPeg = () => {
    if (editableCoords.length < 2) return;
    const p1 = editableCoords[0];
    const p2 = editableCoords[1];
    const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const updated: [number, number][] = [editableCoords[0], mid, ...editableCoords.slice(1)];
    setEditableCoords(updated);
  };

  // Default to Google Maps Real-Time Satellite View
  if (mapEngine === "google" && mapsApiKey) {
    return (
      <GoogleCadastralMap
        apiKey={mapsApiKey}
        mapId={mapId}
        parcels={parcels}
        selectedParcel={selectedParcel}
        onSelectParcel={onSelectParcel}
        activeLayers={activeLayers}
        topologyReport={topologyReport}
        isSurveyorEditing={isSurveyorEditing}
        onSaveSurveyorAdjustment={onSaveSurveyorAdjustment}
        onCancelSurveyorAdjustment={onCancelSurveyorAdjustment}
        telemetry={telemetry}
        ingestionMode={ingestionMode}
        onMapBoundsChange={onMapBoundsChange}
        onSwitchToLeaflet={() => setMapEngine("leaflet")}
        activeGovLayout={activeGovLayout}
        activeDiscrepancy={activeDiscrepancy}
        onOpenGovMapPanel={onOpenGovMapPanel}
        historicalFmbDataset={historicalFmbDataset}
        onTriggerDetectAll={onTriggerDetectAll}
        isDetectingAll={isDetectingAll}
        selectedPlotCongruence={selectedPlotCongruence}
        onSelectPlotCongruence={onSelectPlotCongruence}
        allDiscrepancies={allDiscrepancies}
        driftHotspots={driftHotspots}
        selectedDetection={selectedDetection}
        onSelectDetection={onSelectDetection}
      />
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Switch to Google Satellite Live banner */}
      <div className="absolute top-4 left-4 z-[500] bg-slate-900/95 border border-sky-500/80 rounded-xl p-1.5 shadow-2xl backdrop-blur-md flex items-center gap-2">
        <button
          onClick={() => setMapEngine("google")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow transition"
        >
          <Globe className="w-3.5 h-3.5 text-sky-200" />
          <span>Switch to Google Satellite (Live)</span>
        </button>
      </div>

      {/* Map DOM Container */}
      <div id="gis-leaflet-canvas" ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Navigation Controls */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 shadow-lg flex flex-col gap-1 backdrop-blur-sm">
          <button
            id="map-btn-zoom-in"
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="map-btn-zoom-out"
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-700 my-0.5" />
          <button
            id="map-btn-fit-bounds"
            onClick={handleFitBounds}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Fit All Cadastral Extents"
          >
            <Crosshair className="w-4 h-4 text-sky-400" />
          </button>
          <button
            id="map-btn-ruler"
            onClick={() => {
              setMeasuringMode((prev) => !prev);
              if (measuringMode) setMeasurePoints([]);
            }}
            className={`w-8 h-8 flex items-center justify-center rounded transition ${
              measuringMode
                ? "bg-sky-500 text-white shadow font-bold ring-2 ring-sky-400/50"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="Cadastral Tape Measure (Click map to measure distance & area)"
          >
            <Ruler className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Measuring Mode Floating HUD Banner */}
      {measuringMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/95 border border-sky-500/80 text-sky-200 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Ruler className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-bold text-white">TAPE MEASURE:</span>
            <span>Click on map to drop surveyor pegs.</span>
            {measurePoints.length > 1 && (
              <span className="font-mono font-bold text-white ml-1 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                Line: {totalMeasureDistance.toFixed(1)}m
                {measurePoints.length >= 3 && ` • Enclosed: ${measureArea.toFixed(1)} m²`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            {measurePoints.length > 0 && (
              <button
                id="btn-clear-measure"
                onClick={() => setMeasurePoints([])}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Clear
              </button>
            )}
            <button
              id="btn-close-measure"
              onClick={() => {
                setMeasuringMode(false);
                setMeasurePoints([]);
              }}
              className="text-xs px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Surveyor Active Editing Floating Banner */}
      {isSurveyorEditing && selectedParcel && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/95 border border-amber-500/80 text-amber-200 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce-short">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>SURVEYOR FIELD EDIT MODE: Drag amber vertex pegs to adjust boundary</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-add-vertex-peg"
              onClick={handleAddMidpointPeg}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
              title="Insert Midpoint Vertex Peg"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Add Peg</span>
            </button>

            <button
              id="btn-save-vertex-adj"
              onClick={() => onSaveSurveyorAdjustment(editableCoords)}
              className="flex items-center gap-1 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition"
            >
              <Check className="w-3.5 h-3.5" />
              Save & Lock Hash
            </button>
            <button
              id="btn-cancel-vertex-adj"
              onClick={onCancelSurveyorAdjustment}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Map Legend Overlay in Bottom Left */}
      <div className="absolute bottom-4 left-4 z-[500] bg-slate-900/90 border border-slate-800 text-slate-300 px-3 py-2.5 rounded-lg text-xs shadow-lg backdrop-blur-sm max-w-xs pointer-events-auto">
        <div className="font-semibold text-slate-100 flex items-center gap-1.5 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Cadastral Symbology</span>
        </div>

        {activeLayers.uncertaintyBands ? (
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>Low Uncertainty (Calibrated Confidence &gt; 80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500" />
              <span>Moderate Ambiguity (Shadow/Vegetation)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-rose-500" />
              <span>High Uncertainty (Priority Surveyor Ground Check)</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>Residential</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              <span>Commercial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>Agricultural</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span>Public Commons</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
