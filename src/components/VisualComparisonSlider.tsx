import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sliders, SplitSquareVertical, ArrowLeftRight, Eye, Layers } from "lucide-react";

interface VisualComparisonSliderProps {
  sliderPosition: number; // 0 to 100
  onSliderChange: (pos: number) => void;
  mode: "OVERLAY" | "HISTORICAL_ONLY" | "CURRENT_ONLY" | "SWIPE_COMPARISON";
  onModeChange: (mode: "OVERLAY" | "HISTORICAL_ONLY" | "CURRENT_ONLY" | "SWIPE_COMPARISON") => void;
}

export const VisualComparisonSlider: React.FC<VisualComparisonSliderProps> = ({
  sliderPosition,
  onSliderChange,
  mode,
  onModeChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = Math.round((x / rect.width) * 100);
      onSliderChange(percentage);
    },
    [isDragging, onSliderChange]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Mode Selector Tabs */}
      <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-xl p-1 gap-1 shadow-xl backdrop-blur-md">
        <button
          onClick={() => onModeChange("OVERLAY")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            mode === "OVERLAY"
              ? "bg-sky-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Overlay Fusion</span>
        </button>

        <button
          onClick={() => onModeChange("HISTORICAL_ONLY")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            mode === "HISTORICAL_ONLY"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>1967 Historical FMB</span>
        </button>

        <button
          onClick={() => onModeChange("CURRENT_ONLY")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            mode === "CURRENT_ONLY"
              ? "bg-amber-600 text-white shadow"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>2026 Drone Perception</span>
        </button>

        <button
          onClick={() => onModeChange("SWIPE_COMPARISON")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            mode === "SWIPE_COMPARISON"
              ? "bg-emerald-600 text-white shadow ring-2 ring-emerald-400/40"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Interactive Swipe</span>
        </button>
      </div>

      {/* Swipe Slider Bar (Active when in SWIPE_COMPARISON mode) */}
      {mode === "SWIPE_COMPARISON" && (
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full h-8 bg-slate-950/90 border border-emerald-500/40 rounded-xl px-2 flex items-center shadow-2xl backdrop-blur-md overflow-hidden"
        >
          {/* Background Indicator Labels */}
          <div className="absolute inset-0 flex justify-between items-center px-4 text-[10px] font-bold pointer-events-none">
            <span className="text-indigo-400 uppercase tracking-wide">
              ◀ 1967 Historical Blueprint ({sliderPosition}%)
            </span>
            <span className="text-amber-400 uppercase tracking-wide">
              2026 Drone Satellite ({100 - sliderPosition}%) ▶
            </span>
          </div>

          {/* Interactive Drag Handle */}
          <div
            onPointerDown={handlePointerDown}
            style={{ left: `calc(${sliderPosition}% - 14px)` }}
            className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl border-2 border-white flex items-center justify-center cursor-ew-resize transition-transform hover:scale-110 active:scale-95"
            title="Drag left/right to compare"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
    </div>
  );
};
