import React from "react";
import { UAVTelemetry, Parcel } from "../types";

interface UAVHudReticleOverlayProps {
  telemetry: UAVTelemetry | null;
  selectedParcel: Parcel | null;
  isVisible: boolean;
}

export const UAVHudReticleOverlay: React.FC<UAVHudReticleOverlayProps> = ({
  telemetry,
  selectedParcel,
  isVisible,
}) => {
  if (!isVisible) return null;

  const alt = telemetry?.altitude_agl ?? 48.2;
  const gsd = telemetry?.gsd_cm_px ?? 1.8;
  const heading = telemetry?.heading_deg ?? 45.0;
  const speed = telemetry?.speed_mps ?? 8.5;
  const rtk = telemetry?.rtk_status ?? "FIXED";

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden">
      {/* 4 Viewport Corner Optical Brackets */}
      <div className="absolute top-16 left-16 w-8 h-8 border-t-2 border-l-2 border-cyan-400/70" />
      <div className="absolute top-16 right-16 w-8 h-8 border-t-2 border-r-2 border-cyan-400/70" />
      <div className="absolute bottom-16 left-16 w-8 h-8 border-b-2 border-l-2 border-cyan-400/70" />
      <div className="absolute bottom-16 right-16 w-8 h-8 border-b-2 border-r-2 border-cyan-400/70" />

      {/* Central Targeting Crosshairs & Horizon Gimbal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        {/* Dynamic Rotation with Heading */}
        <div
          className="relative w-48 h-48 rounded-full border border-cyan-500/30 flex items-center justify-center transition-transform duration-300"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          {/* Compass Ticks */}
          <div className="absolute top-1 font-mono text-[9px] font-bold text-cyan-300">N</div>
          <div className="absolute bottom-1 font-mono text-[9px] text-slate-400">S</div>
          <div className="absolute right-1 font-mono text-[9px] text-slate-400">E</div>
          <div className="absolute left-1 font-mono text-[9px] text-slate-400">W</div>

          {/* Artificial Horizon Wings */}
          <div className="w-16 h-0.5 bg-cyan-400/80 -translate-x-10" />
          <div className="w-16 h-0.5 bg-cyan-400/80 translate-x-10" />
        </div>

        {/* Center Target Acquisition Box */}
        <div className="absolute w-12 h-12 border border-emerald-400/80 rounded-sm flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        </div>
      </div>

      {/* Left HUD Telemetry Ladder */}
      <div className="absolute top-1/2 left-6 -translate-y-1/2 font-mono text-[10px] text-cyan-300/90 flex flex-col gap-1 bg-slate-950/60 p-2 rounded-xl backdrop-blur-md border border-cyan-500/20">
        <div className="text-[9px] uppercase text-slate-400 font-bold">ALT AGL</div>
        <div className="text-sm font-bold text-cyan-300">{alt.toFixed(1)} m</div>
        <div className="text-[9px] text-emerald-400 mt-1">GSD: {gsd} cm/px</div>
      </div>

      {/* Right HUD Velocity & Satellites */}
      <div className="absolute top-1/2 right-6 -translate-y-1/2 font-mono text-[10px] text-cyan-300/90 flex flex-col gap-1 bg-slate-950/60 p-2 rounded-xl backdrop-blur-md border border-cyan-500/20 text-right">
        <div className="text-[9px] uppercase text-slate-400 font-bold">SPEED</div>
        <div className="text-sm font-bold text-amber-300">{speed.toFixed(1)} m/s</div>
        <div className="text-[9px] text-emerald-400 mt-1">RTK: {rtk}</div>
      </div>

      {/* Selected Parcel Targeting Box Notification */}
      {selectedParcel && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/40 px-3 py-1 rounded-full text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>TARGET LOCK: {selectedParcel.uprn} ({Math.round(selectedParcel.calculatedAreaSqMeters)}m²)</span>
        </div>
      )}
    </div>
  );
};
