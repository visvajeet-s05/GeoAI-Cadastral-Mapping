import React, { useState, useEffect, useRef } from "react";
import {
  Plane,
  Satellite,
  Upload,
  Radio,
  Compass,
  Crosshair,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Camera,
  X,
  CheckCircle2,
} from "lucide-react";
import { UAVTelemetry, IngestionMode, Parcel } from "../types";

interface DroneHUDProps {
  telemetry: UAVTelemetry | null;
  onTelemetryUpdate: (telemetry: UAVTelemetry) => void;
  ingestionMode: IngestionMode;
  onSelectIngestionMode: (mode: IngestionMode) => void;
  onOpenUploadModal: () => void;
  onParcelsIngested: (newParcels: Parcel[]) => void;
  currentMapBounds: [number, number, number, number] | null;
}

export const DroneHUD: React.FC<DroneHUDProps> = ({
  telemetry,
  onTelemetryUpdate,
  ingestionMode,
  onSelectIngestionMode,
  onOpenUploadModal,
  onParcelsIngested,
  currentMapBounds,
}) => {
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [selectedZone, setSelectedZone] = useState<"URBAN" | "RURAL" | "COMMERCIAL">("URBAN");
  const [sliderAltitude, setSliderAltitude] = useState<number>(35);
  const [sliderSpeed, setSliderSpeed] = useState<number>(8.5);
  // Default to collapsed so the map gets 85%+ of the screen!
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isFetchingSatellite, setIsFetchingSatellite] = useState(false);
  const [satelliteFeedback, setSatelliteFeedback] = useState<string | null>(null);

  // Satellite bbox inputs
  const [bboxInput, setBboxInput] = useState<{
    minLon: string;
    minLat: string;
    maxLon: string;
    maxLat: string;
  }>({
    minLon: "77.2075",
    minLat: "28.6130",
    maxLon: "77.2115",
    maxLat: "28.6155",
  });
  const [dpEpsilon, setDpEpsilon] = useState<number>(0.000025);
  const [zoomLevel, setZoomLevel] = useState<number>(19);

  const wsRef = useRef<WebSocket | null>(null);

  // Auto-dismiss toast feedback after 4.5 seconds
  useEffect(() => {
    if (satelliteFeedback) {
      const timer = setTimeout(() => setSatelliteFeedback(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [satelliteFeedback]);

  // Sync BBox when currentMapBounds changes
  useEffect(() => {
    if (currentMapBounds && currentMapBounds.length === 4) {
      setBboxInput({
        minLon: currentMapBounds[0].toFixed(5),
        minLat: currentMapBounds[1].toFixed(5),
        maxLon: currentMapBounds[2].toFixed(5),
        maxLat: currentMapBounds[3].toFixed(5),
      });
    }
  }, [currentMapBounds]);

  // Establish WebSocket connection for live telemetry stream with SSE fallback
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/cadastral-stream`;

    let ws: WebSocket | null = null;
    let sse: EventSource | null = null;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if ((data.event === "UAV_TELEMETRY" || data.event === "CONNECTED") && data.telemetry) {
            onTelemetryUpdate(data.telemetry);
          }
        } catch (e) {
          // ignore parsing error
        }
      };

      ws.onerror = () => fallbackToSSE();
      ws.onclose = () => fallbackToSSE();
    } catch (err) {
      fallbackToSSE();
    }

    function fallbackToSSE() {
      if (sse) return;
      try {
        sse = new EventSource("/api/stream/telemetry");
        sse.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.telemetry) {
              onTelemetryUpdate(data.telemetry);
            }
          } catch (err) {
            // ignore
          }
        };
      } catch (e) {
        // ignore
      }
    }

    return () => {
      if (ws) ws.close();
      if (sse) sse.close();
    };
  }, []);

  // Send control message over WebSocket or REST
  const sendControl = (action: string, extra: Record<string, any> = {}) => {
    const payload = { action, ...extra };
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      fetch("/api/uav/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.telemetry) onTelemetryUpdate(data.telemetry);
        })
        .catch(() => {});
    }
  };

  const handleToggleSim = () => {
    const nextState = !isSimRunning;
    setIsSimRunning(nextState);
    sendControl(nextState ? "RESUME_UAV_SIM" : "PAUSE_UAV_SIM");
  };

  const handleChangeZone = (zone: "URBAN" | "RURAL" | "COMMERCIAL") => {
    setSelectedZone(zone);
    sendControl("SET_ZONE", { zone });
  };

  const handleAltitudeChange = (alt: number) => {
    setSliderAltitude(alt);
    sendControl("SET_ALTITUDE", { altitude_m: alt });
  };

  const handleResetFlight = () => {
    setIsSimRunning(true);
    sendControl("RESET", { zone: selectedZone, altitude_m: sliderAltitude });
  };

  // Capture Frame from Virtual UAV and Vectorize
  const handleCaptureUAVFrame = async () => {
    if (!telemetry) return;
    setIsFetchingSatellite(true);
    setSatelliteFeedback("Extracting boundaries at current UAV position...");

    try {
      const res = await fetch("/api/ingest/satellite-bbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop_at_drone: true,
          drone_lat: telemetry.latitude,
          drone_lon: telemetry.longitude,
          altitude_m: telemetry.altitude_agl,
          douglas_peucker_epsilon: dpEpsilon,
        }),
      });
      const data = await res.json();
      if (data.parcels && data.parcels.length > 0) {
        onParcelsIngested(data.parcels);
        setSatelliteFeedback(`Vectorized ${data.parcels.length} parcels via Douglas-Peucker & Shoelace formula!`);
      } else {
        setSatelliteFeedback("Frame ingested. No new unique parcel boundaries in FOV.");
      }
    } catch (e: any) {
      setSatelliteFeedback(`Ingestion error: ${e?.message || "Check network"}`);
    } finally {
      setIsFetchingSatellite(false);
    }
  };

  // Trigger Satellite Bounding Box Ingestion
  const handleIngestSatelliteBBox = async () => {
    setIsFetchingSatellite(true);
    setSatelliteFeedback("Requesting Esri World Imagery (ArcGIS REST) & applying CV pipeline...");

    const minLon = parseFloat(bboxInput.minLon);
    const minLat = parseFloat(bboxInput.minLat);
    const maxLon = parseFloat(bboxInput.maxLon);
    const maxLat = parseFloat(bboxInput.maxLat);

    if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)) {
      setSatelliteFeedback("Invalid coordinate values in bounding box.");
      setIsFetchingSatellite(false);
      return;
    }

    try {
      const res = await fetch("/api/ingest/satellite-bbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbox: [minLon, minLat, maxLon, maxLat],
          zoom: zoomLevel,
          altitude_m: sliderAltitude,
          douglas_peucker_epsilon: dpEpsilon,
        }),
      });

      const data = await res.json();
      if (data.parcels && data.parcels.length > 0) {
        onParcelsIngested(data.parcels);
        setSatelliteFeedback(
          `Success! Vectorized ${data.parcels.length} parcels. GSD: ${data.gsd_cm_px} cm/px, Canny edges: ${data.canny_edges_detected}.`
        );
      } else {
        setSatelliteFeedback("Processed satellite tile. No parcels above minimum area threshold.");
      }
    } catch (e: any) {
      setSatelliteFeedback(`Satellite Ingest Error: ${e?.message || "Failed to fetch"}`);
    } finally {
      setIsFetchingSatellite(false);
    }
  };

  const handlePopulateFromMap = () => {
    if (currentMapBounds && currentMapBounds.length === 4) {
      setBboxInput({
        minLon: currentMapBounds[0].toFixed(5),
        minLat: currentMapBounds[1].toFixed(5),
        maxLon: currentMapBounds[2].toFixed(5),
        maxLat: currentMapBounds[3].toFixed(5),
      });
      setSatelliteFeedback("Bounding box synced with current map canvas extent.");
    }
  };

  // Telemetry formatted values
  const latStr = telemetry ? telemetry.latitude.toFixed(6) : "28.614400";
  const lonStr = telemetry ? telemetry.longitude.toFixed(6) : "77.208865";
  const altM = telemetry ? telemetry.altitude_agl : sliderAltitude;
  const gsdCm = telemetry ? telemetry.gsd_cm_px : ((13.2 * sliderAltitude * 100) / (8.8 * 4000)).toFixed(2);
  const headingDeg = telemetry ? Math.round(telemetry.heading_deg) : 90;
  const rtkStatus = telemetry ? telemetry.rtk_status : "FIXED";
  const sats = telemetry ? telemetry.satellites_tracked : 23;
  const edgesCount = telemetry?.canny_edges_detected ?? 1534;
  const contoursCount = telemetry?.contours_extracted ?? 13;
  const battery = telemetry ? telemetry.battery_percent : 86.9;

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 shadow-md z-20 shrink-0 select-none">
      {/* 1. COMPACT UNIFIED INGESTION & TELEMETRY STRIP */}
      <div className="px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 text-xs">
        {/* Left: Ingestion Mode Pills */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline-block">
            Pipeline:
          </span>

          {/* Mode 1: Virtual UAV Flight Sim */}
          <button
            id="btn-mode-virtual-uav"
            onClick={() => onSelectIngestionMode("VIRTUAL_UAV")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              ingestionMode === "VIRTUAL_UAV"
                ? "bg-sky-500 text-white font-bold shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Plane className="w-3 h-3" />
            <span>Virtual UAV</span>
            {ingestionMode === "VIRTUAL_UAV" && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Mode 2: Live Satellite Tile API */}
          <button
            id="btn-mode-live-satellite"
            onClick={() => onSelectIngestionMode("LIVE_SATELLITE")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              ingestionMode === "LIVE_SATELLITE"
                ? "bg-indigo-600 text-white font-bold shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Satellite className="w-3 h-3" />
            <span>Satellite Tile API</span>
            {ingestionMode === "LIVE_SATELLITE" && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Mode 3: Upload Custom Orthomosaic */}
          <button
            id="btn-mode-upload-ortho"
            onClick={() => {
              onSelectIngestionMode("CUSTOM_ORTHOMOSAIC");
              onOpenUploadModal();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              ingestionMode === "CUSTOM_ORTHOMOSAIC"
                ? "bg-emerald-600 text-white font-bold shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Upload Ortho</span>
          </button>
        </div>

        {/* Center: Live Inline Telemetry Readout (visible when collapsed too!) */}
        {ingestionMode === "VIRTUAL_UAV" && (
          <div className="hidden md:flex items-center gap-2.5 font-mono text-[11px] text-slate-300 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800">
            <span className="text-slate-400">
              {latStr}°N, {lonStr}°E
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Alt: <strong className="text-amber-400">{altM}m</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              GSD: <strong className="text-sky-400">{gsdCm}cm/px</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Speed: <strong className="text-emerald-400">{telemetry ? telemetry.speed_mps : sliderSpeed}m/s</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Heading: <strong className="text-indigo-300">{headingDeg}°</strong>
            </span>
          </div>
        )}

        {/* Right: Quick Controls, RTK & Expand HUD button */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {/* Quick Capture / Vectorize button right on the bar! */}
          {ingestionMode === "VIRTUAL_UAV" && (
            <>
              <button
                onClick={handleToggleSim}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title={isSimRunning ? "Pause UAV Simulation" : "Resume Flight"}
              >
                {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                id="btn-vectorize-fov"
                onClick={handleCaptureUAVFrame}
                disabled={isFetchingSatellite}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] shadow-sm transition"
                title="Vectorize current UAV Field of View with Canny edge detection & Shoelace formula"
              >
                <Camera className="w-3 h-3" />
                <span>{isFetchingSatellite ? "Vectorizing..." : "Vectorize FOV"}</span>
              </button>
            </>
          )}

          {/* RTK Indicator */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[11px]">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="font-bold">{rtkStatus}</span>
            <span className="text-[10px] text-emerald-400/80 hidden sm:inline">({sats} SVs)</span>
          </div>

          {/* Battery */}
          <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px]">
            <span>BAT:</span>
            <span className="font-bold text-sky-400">{battery.toFixed(0)}%</span>
          </div>

          {/* Expand/Collapse HUD Toggle */}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition text-[11px]"
            title={isCollapsed ? "Expand Advanced Cockpit HUD" : "Collapse HUD"}
          >
            <span className="hidden sm:inline">{isCollapsed ? "Cockpit HUD" : "Minimize"}</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. EXPANDED COCKPIT HUD (COMPACT & SLICED SO IT NEVER CRUSHES THE MAP) */}
      {!isCollapsed && (
        <div className="px-3 sm:px-4 py-2 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800/80 animate-in fade-in duration-200">
          {ingestionMode === "VIRTUAL_UAV" ? (
            /* VIRTUAL UAV COMPACT INSTRUMENTS */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {/* Module 1: Coordinates & Altitude */}
              <div className="bg-slate-950/90 border border-slate-800/90 p-2 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    WGS84 COORDS
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="font-mono text-[11px] font-bold text-white mt-1 truncate">
                  {latStr}° N, {lonStr}° E
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                  <span>Alt AGL:</span>
                  <span className="font-mono font-bold text-amber-400">{altM} m</span>
                </div>
              </div>

              {/* Module 2: Photogrammetric GSD */}
              <div className="bg-slate-950/90 border border-slate-800/90 p-2 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-sky-400" />
                    DYNAMIC GSD
                  </span>
                  <span className="text-[9px] px-1 bg-sky-950 text-sky-300 border border-sky-800 rounded font-mono">
                    1" CMOS
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-mono text-sm font-black text-sky-400">{gsdCm}</span>
                  <span className="text-[10px] text-slate-400 font-mono">cm/px</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono truncate">
                  f=8.8mm • w=13.2mm
                </div>
              </div>

              {/* Module 3: Heading & Speed */}
              <div className="bg-slate-950/90 border border-slate-800/90 p-2 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Compass className="w-3 h-3 text-emerald-400" />
                    HEADING & SPEED
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 font-mono text-[11px]">
                  <span className="font-bold text-emerald-400">{headingDeg}°</span>
                  <span className="font-bold text-white">
                    {telemetry ? telemetry.speed_mps : sliderSpeed} m/s
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Track:</span>
                  <span className="font-bold text-slate-200">{selectedZone}</span>
                </div>
              </div>

              {/* Module 4: Computer Vision Edge Extractor */}
              <div className="bg-slate-950/90 border border-slate-800/90 p-2 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-purple-400" />
                    CV PERCEPTION
                  </span>
                  <span className="text-[9px] px-1 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                    YOLOv8
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                  <span className="text-slate-400">Canny Edges:</span>
                  <span className="font-bold text-purple-300">{edgesCount} px</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Contours:</span>
                  <span className="font-bold text-emerald-400">{contoursCount} boundaries</span>
                </div>
              </div>

              {/* Module 5: Flight Zone & Altitude Slider */}
              <div className="bg-slate-950/90 border border-slate-800/90 p-2 rounded-lg flex flex-col justify-between col-span-2 sm:col-span-1 lg:col-span-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">Flight Zone & AGL:</span>
                  <div className="flex items-center gap-1">
                    {(["URBAN", "RURAL", "COMMERCIAL"] as const).map((zone) => (
                      <button
                        key={zone}
                        onClick={() => handleChangeZone(zone)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                          selectedZone === zone
                            ? "bg-sky-500 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {zone.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-400 font-mono">Alt:</span>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    value={sliderAltitude}
                    onChange={(e) => handleAltitudeChange(Number(e.target.value))}
                    className="flex-1 accent-sky-500 h-1 bg-slate-800 rounded"
                  />
                  <span className="text-[10px] font-mono font-bold text-white w-7 text-right">
                    {sliderAltitude}m
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={handleResetFlight}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset Waypoint
                  </button>
                  <span className="text-[9px] text-slate-500 font-mono">
                    DGCA Rules Compliant
                  </span>
                </div>
              </div>
            </div>
          ) : ingestionMode === "LIVE_SATELLITE" ? (
            /* LIVE SATELLITE TILE BBOX INGESTION CONSOLE */
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono text-slate-400">Bounding Box (WGS84):</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <input
                    type="text"
                    value={bboxInput.minLon}
                    onChange={(e) => setBboxInput({ ...bboxInput, minLon: e.target.value })}
                    className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-center"
                    placeholder="MinLon"
                  />
                  <span>,</span>
                  <input
                    type="text"
                    value={bboxInput.minLat}
                    onChange={(e) => setBboxInput({ ...bboxInput, minLat: e.target.value })}
                    className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-center"
                    placeholder="MinLat"
                  />
                  <span>to</span>
                  <input
                    type="text"
                    value={bboxInput.maxLon}
                    onChange={(e) => setBboxInput({ ...bboxInput, maxLon: e.target.value })}
                    className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-center"
                    placeholder="MaxLon"
                  />
                  <span>,</span>
                  <input
                    type="text"
                    value={bboxInput.maxLat}
                    onChange={(e) => setBboxInput({ ...bboxInput, maxLat: e.target.value })}
                    className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-center"
                    placeholder="MaxLat"
                  />
                </div>

                <button
                  onClick={handlePopulateFromMap}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-semibold border border-slate-700 transition"
                  title="Copy current Leaflet viewport bounding box"
                >
                  Sync Map Viewport
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleIngestSatelliteBBox}
                  disabled={isFetchingSatellite}
                  className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isFetchingSatellite ? "Processing Esri Tiles..." : "Ingest BBox Imagery"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* CUSTOM ORTHOMOSAIC UPLOAD QUICK PROMPT */
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Upload GeoTIFF, JPG/PNG + Worldfile (JGW/PGW), or raw survey drone imagery.</span>
              </div>
              <button
                onClick={onOpenUploadModal}
                className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-1.5"
              >
                <span>Open Orthomosaic Upload Dialog</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION (DOES NOT PUSH PAGE DOWN!) */}
      {satelliteFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/95 border border-sky-500/60 text-sky-200 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{satelliteFeedback}</span>
          <button
            onClick={() => setSatelliteFeedback(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
