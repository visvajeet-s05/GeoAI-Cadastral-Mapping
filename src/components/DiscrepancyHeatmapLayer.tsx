import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import {
  Flame,
  Layers,
  Eye,
  EyeOff,
  Maximize2,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Info,
} from "lucide-react";
import { EncroachmentDiscrepancy, DriftHotspot } from "../types";

export interface DiscrepancyHeatmapProps {
  map?: google.maps.Map | null;
  leafletMap?: any | null;
  discrepancies: EncroachmentDiscrepancy[];
  hotspots?: DriftHotspot[];
  visible: boolean;
  onToggleVisible?: () => void;
  onSelectDiscrepancy?: (d: EncroachmentDiscrepancy) => void;
}

export type HeatmapMetric = "deviation" | "area" | "frequency";
export type HeatmapColorPalette = "inferno" | "turbo" | "ylOrRd";

export const DiscrepancyHeatmapLayer: React.FC<DiscrepancyHeatmapProps> = ({
  map,
  leafletMap,
  discrepancies,
  hotspots: propHotspots,
  visible,
  onToggleVisible,
  onSelectDiscrepancy,
}) => {
  // Configurable Heatmap State
  const [radius, setRadius] = useState<number>(38);
  const [intensity, setIntensity] = useState<number>(0.9);
  const [opacity, setOpacity] = useState<number>(0.85);
  const [metric, setMetric] = useState<HeatmapMetric>("deviation");
  const [palette, setPalette] = useState<HeatmapColorPalette>("inferno");
  const [showDriftVectors, setShowDriftVectors] = useState<boolean>(true);
  const [showHotspotPills, setShowHotspotPills] = useState<boolean>(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"tune" | "hotspots">("tune");
  const [hoveredHotspot, setHoveredHotspot] = useState<DriftHotspot | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  // Compute or aggregate hotspots from discrepancies if not directly provided
  const resolvedHotspots = useMemo<DriftHotspot[]>(() => {
    if (propHotspots && propHotspots.length > 0) {
      return propHotspots;
    }

    const items: DriftHotspot[] = [];

    discrepancies.forEach((d) => {
      // 1. Encroachment Polygon Vertices / Centroid
      if (d.encroachmentPolygon && d.encroachmentPolygon.length > 0) {
        const cLat =
          d.encroachmentPolygon.reduce((acc, p) => acc + p[1], 0) /
          d.encroachmentPolygon.length;
        const cLng =
          d.encroachmentPolygon.reduce((acc, p) => acc + p[0], 0) /
          d.encroachmentPolygon.length;

        // Base weight normalized from deviation & area
        const normDev = Math.min(1.0, d.maxDeviationMeters / 2.0);
        const normArea = Math.min(1.0, d.encroachmentAreaSqM / 250);
        const weight = Math.min(1.0, Math.max(0.3, normDev * 0.7 + normArea * 0.3));

        items.push({
          lat: cLat,
          lng: cLng,
          weight,
          deviationMeters: d.maxDeviationMeters,
          areaSqM: d.encroachmentAreaSqM,
          encroachmentType: d.encroachmentType,
          parcelId: d.parcelId,
          uprn: d.uprn,
          ownerName: d.ownerName,
          sourceType:
            d.encroachmentType === "ROAD_RESERVE_VIOLATION"
              ? "ROAD_ENCROACHMENT"
              : "SATELLITE_LEGAL_DRIFT",
          driftVector:
            d.legalBoundary && d.detectedPhysicalBoundary
              ? {
                  fromLegal: d.legalBoundary[0],
                  toPhysical: d.detectedPhysicalBoundary[0],
                }
              : undefined,
        });

        // Add additional sample points along detected physical vertices that drift
        if (d.detectedPhysicalBoundary && d.legalBoundary) {
          const len = d.detectedPhysicalBoundary.length;
          for (let i = 0; i < len; i++) {
            const phys = d.detectedPhysicalBoundary[i];

            // Find nearest legal boundary vertex to measure true localized drift
            let minDist = Infinity;
            let closestLeg = d.legalBoundary[0];
            for (const leg of d.legalBoundary) {
              const dLng =
                (phys[0] - leg[0]) * 111320 * Math.cos((phys[1] * Math.PI) / 180);
              const dLat = (phys[1] - leg[1]) * 110540;
              const curDist = Math.hypot(dLng, dLat);
              if (curDist < minDist) {
                minDist = curDist;
                closestLeg = leg;
              }
            }

            // Bound localized deviation to surveyor recorded maximum
            const realDist = Math.min(minDist, d.maxDeviationMeters || 1.8);

            if (realDist > 0.25) {
              items.push({
                lat: phys[1],
                lng: phys[0],
                weight: Math.min(1.0, realDist / 2.0),
                deviationMeters: Math.round(realDist * 100) / 100,
                areaSqM: d.encroachmentAreaSqM / len,
                encroachmentType: d.encroachmentType,
                parcelId: d.parcelId,
                uprn: d.uprn,
                ownerName: d.ownerName,
                sourceType: "BOUNDARY_SHIFT",
                driftVector: {
                  fromLegal: closestLeg,
                  toPhysical: phys,
                },
              });
            }
          }
        }
      }
    });

    return items;
  }, [propHotspots, discrepancies]);

  // Statistics
  const stats = useMemo(() => {
    const totalHotspots = resolvedHotspots.length;
    const maxDev =
      discrepancies.length > 0
        ? Math.max(...discrepancies.map((d) => d.maxDeviationMeters || 0))
        : resolvedHotspots.reduce(
            (max, h) => Math.max(max, h.deviationMeters),
            0
          );
    const totalArea = discrepancies.reduce(
      (sum, d) => sum + (d.encroachmentAreaSqM || 0),
      0
    );
    const highSeverityCount = resolvedHotspots.filter(
      (h) => h.deviationMeters >= 1.0
    ).length;
    return {
      totalHotspots,
      maxDev: Math.round(maxDev * 100) / 100,
      totalArea: Math.round(totalArea * 10) / 10,
      highSeverityCount,
    };
  }, [resolvedHotspots, discrepancies]);

  // D3 Color Scale Generator
  const getColorScale = useCallback(
    (paletteType: HeatmapColorPalette) => {
      switch (paletteType) {
        case "turbo":
          return d3.scaleSequential(d3.interpolateTurbo).domain([0, 1]);
        case "ylOrRd":
          return d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);
        case "inferno":
        default:
          return d3.scaleSequential(d3.interpolateInferno).domain([0, 1]);
      }
    },
    []
  );

  // Generate a 256-color lookup table from D3 for ultra-fast per-pixel canvas transfer
  const colorTable = useMemo(() => {
    const scale = getColorScale(palette);
    const table = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const rgbStr = scale(t);
      const color = d3.color(rgbStr);
      if (color) {
        const rgb = color.rgb();
        table[i * 4] = rgb.r;
        table[i * 4 + 1] = rgb.g;
        table[i * 4 + 2] = rgb.b;
        // Apply smooth alpha curve
        table[i * 4 + 3] = Math.round(Math.pow(t, 0.75) * 255 * opacity);
      } else {
        table[i * 4] = 0;
        table[i * 4 + 1] = 0;
        table[i * 4 + 2] = 0;
        table[i * 4 + 3] = 0;
      }
    }
    return table;
  }, [palette, opacity, getColorScale]);

  // Render Heatmap on Canvas using Google Maps OverlayView or Leaflet
  const drawHeatmap = useCallback(() => {
    if (!canvasRef.current || !visible) return;

    let width = 0;
    let height = 0;
    let getPixel: (lat: number, lng: number) => { x: number; y: number } | null = () => null;

    if (map && overlayRef.current) {
      const overlay = overlayRef.current;
      const projection = overlay.getProjection();
      if (!projection) return;
      const mapDiv = map.getDiv();
      width = mapDiv.clientWidth;
      height = mapDiv.clientHeight;
      getPixel = (lat, lng) => {
        const p = projection.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng));
        return p ? { x: p.x, y: p.y } : null;
      };
    } else if (leafletMap) {
      const container = leafletMap.getContainer();
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      getPixel = (lat, lng) => {
        const p = leafletMap.latLngToContainerPoint([lat, lng]);
        return p ? { x: p.x, y: p.y } : null;
      };
    } else {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (resolvedHotspots.length === 0) return;

    // Create offscreen buffer for density accumulation
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    // Step 1: Draw radial Gaussian stamps on grayscale offscreen buffer
    resolvedHotspots.forEach((h) => {
      const pixel = getPixel(h.lat, h.lng);
      if (!pixel) return;

      const px = pixel.x;
      const py = pixel.y;

      // Skip points far outside viewport
      if (px < -radius * 2 || px > width + radius * 2 || py < -radius * 2 || py > height + radius * 2) {
        return;
      }

      // Calculate weight based on chosen metric
      let ptWeight = h.weight;
      if (metric === "deviation") {
        ptWeight = Math.min(1.0, Math.max(0.15, h.deviationMeters / 2.0));
      } else if (metric === "area") {
        ptWeight = Math.min(1.0, Math.max(0.15, h.areaSqM / 200));
      } else {
        // frequency: constant weight accumulation
        ptWeight = 0.5;
      }

      const effectiveRadius = radius * (0.8 + ptWeight * 0.5);
      const stampGradient = offCtx.createRadialGradient(
        px,
        py,
        0,
        px,
        py,
        effectiveRadius
      );

      const alpha = Math.min(1.0, ptWeight * intensity);
      stampGradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
      stampGradient.addColorStop(0.35, `rgba(0,0,0,${alpha * 0.7})`);
      stampGradient.addColorStop(0.7, `rgba(0,0,0,${alpha * 0.25})`);
      stampGradient.addColorStop(1, "rgba(0,0,0,0)");

      offCtx.fillStyle = stampGradient;
      offCtx.beginPath();
      offCtx.arc(px, py, effectiveRadius, 0, Math.PI * 2);
      offCtx.fill();
    });

    // Step 2: Colorize density buffer using D3 colormap lookup
    const imgData = offCtx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    const len = pixels.length;

    for (let i = 3; i < len; i += 4) {
      const alphaVal = pixels[i];
      if (alphaVal > 4) {
        const colorIdx = alphaVal * 4;
        pixels[i - 3] = colorTable[colorIdx];     // Red
        pixels[i - 2] = colorTable[colorIdx + 1]; // Green
        pixels[i - 1] = colorTable[colorIdx + 2]; // Blue
        pixels[i] = colorTable[colorIdx + 3];     // Alpha
      } else {
        pixels[i] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Step 3: Overlay Drift Vectors and Epipolar Deviation Lines
    if (showDriftVectors) {
      resolvedHotspots.forEach((h) => {
        if (!h.driftVector) return;

        const pFrom = getPixel(h.driftVector.fromLegal[1], h.driftVector.fromLegal[0]);
        const pTo = getPixel(h.driftVector.toPhysical[1], h.driftVector.toPhysical[0]);

        if (!pFrom || !pTo) return;

        // Draw drift displacement line
        const isSevere = h.deviationMeters >= 1.0;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pFrom.x, pFrom.y);
        ctx.lineTo(pTo.x, pTo.y);
        ctx.strokeStyle = isSevere ? "#f43f5e" : "#f59e0b";
        ctx.lineWidth = isSevere ? 2.5 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();

        // Draw arrow head at physical building location
        const angle = Math.atan2(pTo.y - pFrom.y, pTo.x - pFrom.x);
        const headLen = 7;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pTo.x, pTo.y);
        ctx.lineTo(
          pTo.x - headLen * Math.cos(angle - Math.PI / 6),
          pTo.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          pTo.x - headLen * Math.cos(angle + Math.PI / 6),
          pTo.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = isSevere ? "#f43f5e" : "#f59e0b";
        ctx.fill();

        // Draw Legal vertex ring
        ctx.beginPath();
        ctx.arc(pFrom.x, pFrom.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw Physical vertex pin
        ctx.beginPath();
        ctx.arc(pTo.x, pTo.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isSevere ? "#ef4444" : "#f59e0b";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      });
    }

    // Step 4: Pulsing epicenter rings on peak encroachment nodes
    resolvedHotspots
      .filter((h) => h.deviationMeters >= 1.4)
      .forEach((h) => {
        const pixel = getPixel(h.lat, h.lng);
        if (!pixel) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();

        // Outer glow
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });
  }, [
    map,
    leafletMap,
    visible,
    resolvedHotspots,
    radius,
    intensity,
    metric,
    colorTable,
    showDriftVectors,
  ]);

  // Lifecycle: attach to Google Maps or Leaflet
  useEffect(() => {
    if (!map && !leafletMap) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0px";
    canvas.style.top = "0px";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "25";
    canvasRef.current = canvas;

    if (map) {
      class HeatmapOverlay extends google.maps.OverlayView {
        canvas: HTMLCanvasElement;

        constructor(canvas: HTMLCanvasElement) {
          super();
          this.canvas = canvas;
        }

        onAdd() {
          const m = this.getMap();
          const mapDiv = m && "getDiv" in m ? (m as google.maps.Map).getDiv() : null;
          if (mapDiv) {
            mapDiv.appendChild(this.canvas);
          } else {
            this.getPanes()?.overlayLayer.appendChild(this.canvas);
          }
        }

        draw() {
          drawHeatmap();
        }

        onRemove() {
          if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
          }
        }
      }

      const overlay = new HeatmapOverlay(canvas);
      overlay.setMap(map);
      overlayRef.current = overlay;

      const listeners = [
        map.addListener("idle", drawHeatmap),
        map.addListener("zoom_changed", drawHeatmap),
        map.addListener("drag", drawHeatmap),
        map.addListener("heading_changed", drawHeatmap),
        map.addListener("tilt_changed", drawHeatmap),
      ];

      return () => {
        listeners.forEach((l) => google.maps.event.removeListener(l));
        overlay.setMap(null);
        overlayRef.current = null;
        canvasRef.current = null;
      };
    } else if (leafletMap) {
      const container = leafletMap.getContainer();
      if (container) {
        container.appendChild(canvas);
      }

      drawHeatmap();

      const onMapMove = () => drawHeatmap();
      leafletMap.on("move", onMapMove);
      leafletMap.on("zoom", onMapMove);
      leafletMap.on("viewreset", onMapMove);
      leafletMap.on("resize", onMapMove);

      return () => {
        leafletMap.off("move", onMapMove);
        leafletMap.off("zoom", onMapMove);
        leafletMap.off("viewreset", onMapMove);
        leafletMap.off("resize", onMapMove);
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        canvasRef.current = null;
      };
    }
  }, [map, leafletMap, drawHeatmap]);

  // Trigger draw whenever parameters change
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.draw();
    }
  }, [drawHeatmap]);

  if (!visible) return null;

  return (
    <div className="select-none pointer-events-auto">
      {/* Floating Encroachment Heatmap HUD Widget (Bottom-Left) */}
      {isHudCollapsed ? (
        <div
          onClick={() => setIsHudCollapsed(false)}
          className="absolute bottom-4 left-4 z-[420] flex items-center gap-2.5 px-3 py-2 bg-slate-900/95 hover:bg-slate-800/95 border border-rose-500/50 rounded-xl shadow-2xl backdrop-blur-md cursor-pointer transition text-white ring-1 ring-rose-500/20 group"
          title="Expand Encroachment Heatmap Controls & Hotspot List"
        >
          <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
            <Flame className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-200">Drift Heatmap</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold">
              +{stats.maxDev}m Peak
            </span>
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              ({stats.totalHotspots} points • {stats.totalArea} m²)
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition ml-1" />
        </div>
      ) : (
        <div className="absolute bottom-4 left-4 z-[420] w-76 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-rose-500/50 rounded-2xl shadow-2xl backdrop-blur-xl text-white overflow-hidden transition-all ring-1 ring-rose-500/20">
          {/* Header Ribbon */}
          <div className="px-3 py-2 bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/70 border-b border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Flame className="w-3.5 h-3.5 animate-pulse text-amber-300" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Encroachment Drift Heatmap</span>
                </h4>
                <div className="text-[10px] text-rose-300/80 font-mono">
                  {stats.totalHotspots} points • Peak +{stats.maxDev}m
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onToggleVisible && (
                <button
                  onClick={onToggleVisible}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  title="Hide Heatmap Layer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsHudCollapsed(true)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                title="Collapse to pill"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-3 divide-x divide-slate-800 bg-slate-950/80 border-b border-slate-800/80 text-center font-mono py-1.5 px-2">
            <div>
              <div className="text-[9px] text-slate-400">HOTSPOTS</div>
              <div className="text-xs font-bold text-amber-400">{stats.totalHotspots}</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-400">PEAK SHIFT</div>
              <div className="text-xs font-bold text-rose-400">+{stats.maxDev}m</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-400">AFFECTED</div>
              <div className="text-xs font-bold text-rose-300">{stats.totalArea} m²</div>
            </div>
          </div>

          {/* Structured Tabs Header */}
          <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs">
            <button
              onClick={() => setActiveTab("tune")}
              className={`flex-1 py-1.5 font-medium transition text-center border-b-2 ${
                activeTab === "tune"
                  ? "border-rose-500 text-rose-300 font-bold bg-rose-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Tuning & Ramp
            </button>
            <button
              onClick={() => setActiveTab("hotspots")}
              className={`flex-1 py-1.5 font-medium transition text-center border-b-2 ${
                activeTab === "hotspots"
                  ? "border-rose-500 text-rose-300 font-bold bg-rose-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Hotspots ({discrepancies.length})
            </button>
          </div>

          {/* Tab 1: Tuning & Parameters */}
          {activeTab === "tune" && (
            <div className="p-3 space-y-2.5 text-xs">
              {/* Metric Mode Switcher */}
              <div>
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Weight Intensity By:
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                  {(["deviation", "area", "frequency"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={`py-1 rounded font-medium capitalize transition ${
                        metric === m
                          ? "bg-rose-600 text-white font-bold shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {m === "deviation" ? "Deviation" : m === "area" ? "Area (m²)" : "Frequency"}
                    </button>
                  ))}
                </div>
              </div>

              {/* D3 Gradient Preview Bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Thermal Spectrum:</span>
                  <div className="flex items-center gap-1">
                    {(["inferno", "turbo", "ylOrRd"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPalette(p)}
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono capitalize ${
                          palette === p
                            ? "bg-rose-900 text-white font-bold border border-rose-500/50"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {p === "ylOrRd" ? "Yellow-Red" : p}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="h-2 w-full rounded-full border border-slate-700 shadow-inner"
                  style={{
                    background:
                      palette === "inferno"
                        ? "linear-gradient(to right, #000004, #57106e, #bb3754, #f98e09, #fcffa4)"
                        : palette === "turbo"
                        ? "linear-gradient(to right, #30123b, #4686fb, #1ae4b6, #a2fc3c, #e83f00)"
                        : "linear-gradient(to right, #ffffb2, #fecc5c, #fd8d3c, #f03b20, #bd0026)",
                  }}
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-1">
                  <span className="text-emerald-400">≤0.25m</span>
                  <span className="text-amber-400">0.80m</span>
                  <span className="text-rose-400 font-bold">≥1.50m</span>
                </div>
              </div>

              {/* Sliders in compact grid */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Radius:</span>
                    <span className="font-mono text-slate-200">{radius}px</span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="60"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Opacity:</span>
                    <span className="font-mono text-slate-200">{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
              </div>

              {/* Vectors checkbox */}
              <div className="pt-1 border-t border-slate-800/80">
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={showDriftVectors}
                    onChange={(e) => setShowDriftVectors(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <span>Show Directional Drift Vectors (Legal → Physical)</span>
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: Hotspot Records List */}
          {activeTab === "hotspots" && (
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {discrepancies.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-xs">
                  No critical discrepancy records found.
                </div>
              ) : (
                discrepancies.map((d, idx) => (
                  <div
                    key={`hud-disc-${idx}`}
                    onClick={() => {
                      if (map && d.encroachmentPolygon && d.encroachmentPolygon.length > 0) {
                        map.panTo({
                          lat: d.encroachmentPolygon[0][1],
                          lng: d.encroachmentPolygon[0][0],
                        });
                        map.setZoom(19);
                      }
                      if (onSelectDiscrepancy) onSelectDiscrepancy(d);
                    }}
                    className="p-1.5 rounded-lg bg-slate-950/70 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 cursor-pointer transition flex items-center justify-between text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-ping" />
                      <span className="font-bold text-slate-200 truncate">
                        {d.ownerName || d.parcelId}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        ({d.uprn})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-bold text-rose-400 shrink-0">
                      <span>+{d.maxDeviationMeters}m</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
