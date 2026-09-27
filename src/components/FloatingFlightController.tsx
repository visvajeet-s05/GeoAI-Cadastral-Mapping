import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Plane,
  Compass,
  Gauge,
  Radio,
  Sliders,
  Eye,
  Crosshair,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { UAVTelemetry } from "../types";

interface FloatingFlightControllerProps {
  telemetry: UAVTelemetry | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetFlight: () => void;
  altitude: number;
  onAltitudeChange: (alt: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  zone: "URBAN" | "RURAL" | "COMMERCIAL";
  onZoneChange: (zone: "URBAN" | "RURAL" | "COMMERCIAL") => void;
  isFollowDrone: boolean;
  onToggleFollowDrone: () => void;
  isReticleVisible: boolean;
  onToggleReticle: () => void;
  onClose?: () => void;
}

export const FloatingFlightController: React.FC<FloatingFlightControllerProps> = ({
  telemetry,
  isPlaying,
  onTogglePlay,
  onResetFlight,
  altitude,
  onAltitudeChange,
  speed,
  onSpeedChange,
  zone,
  onZoneChange,
  isFollowDrone,
  onToggleFollowDrone,
  isReticleVisible,
  onToggleReticle,
  onClose,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const alt = telemetry?.altitude_agl ?? altitude;
  const spd = telemetry?.speed_mps ?? speed;
  const hdg = telemetry?.heading_deg ?? 45.0;
  const gsd = telemetry?.gsd_cm_px ?? 1.8;
  const rtk = telemetry?.rtk_status ?? "FIXED";
  const sats = telemetry?.satellites_tracked ?? 22;
  const battery = telemetry?.battery_percent ?? 98.4;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-full max-w-2xl px-4">
      <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-2.5 shadow-2xl shadow-slate-950/80 flex flex-col gap-2">
        {/* Main Single-Line Controller Row */}
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Left: Drone Status & Play/Pause */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`p-2 rounded-xl font-bold flex items-center justify-center transition shadow-lg ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
              }`}
              title={isPlaying ? "Pause UAV Flight Simulation" : "Start Live UAV Flight Simulation"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={onResetFlight}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Reset Flight Waypoints"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-white font-mono text-[11px]">
                  SIMULATED UAV SENSOR FEED
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">RTK {rtk}</span>
                <span>&bull;</span>
                <span>{sats} SATS</span>
                <span>&bull;</span>
                <span>BAT {battery}%</span>
              </div>
            </div>
          </div>

          {/* Center: Live Telemetry Metrics */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] font-mono">
            <div>
              <span className="text-slate-500">ALT:</span>{" "}
              <span className="text-cyan-300 font-bold">{alt}m</span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="text-slate-500">GSD:</span>{" "}
              <span className="text-emerald-400 font-bold">{gsd}cm</span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="text-slate-500">SPD:</span>{" "}
              <span className="text-amber-300 font-bold">{spd}m/s</span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="text-slate-500">HDG:</span>{" "}
              <span className="text-purple-300 font-bold">{hdg}°</span>
            </div>
          </div>

          {/* Right: Camera Follow & HUD Controls */}
          <div className="flex items-center gap-1.5">
            {/* Follow Drone Camera Toggle */}
            <button
              onClick={onToggleFollowDrone}
              className={`px-2.5 py-1.5 rounded-xl font-semibold text-[11px] font-mono transition flex items-center gap-1 ${
                isFollowDrone
                  ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Lock Map Viewport on Drone Position"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isFollowDrone ? "Locked" : "Follow"}</span>
            </button>

            {/* Reticle Overlay Toggle */}
            <button
              onClick={onToggleReticle}
              className={`p-1.5 rounded-xl transition ${
                isReticleVisible
                  ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle HUD Target Reticle Overlay"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>

            {/* Expand Detailed Sliders Toggle */}
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              title="Show flight tuning parameters"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Parameter Tuning Panel */}
        {isExpanded && (
          <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Altitude Slider */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                <span>Altitude (AGL):</span>
                <span className="text-cyan-300 font-bold">{altitude} m</span>
              </div>
              <input
                type="range"
                min="15"
                max="150"
                step="5"
                value={altitude}
                onChange={(e) => onAltitudeChange(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Speed Slider */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                <span>Ground Speed:</span>
                <span className="text-amber-300 font-bold">{speed} m/s</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Flight Zone Switcher */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">Flight Zone:</span>
              <div className="flex gap-1 font-mono text-[10px]">
                {(["URBAN", "RURAL", "COMMERCIAL"] as const).map((z) => (
                  <button
                    key={z}
                    onClick={() => onZoneChange(z)}
                    className={`px-1.5 py-0.5 rounded transition ${
                      zone === z
                        ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
