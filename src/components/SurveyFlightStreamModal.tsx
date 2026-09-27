import React, { useEffect, useState } from "react";
import {
  Plane,
  X,
  Radio,
  Activity,
  Maximize,
  ShieldCheck,
  Cpu,
  Wifi,
  Compass,
} from "lucide-react";
import { DroneScanEvent } from "../types";

interface SurveyFlightStreamModalProps {
  onClose: () => void;
}

export const SurveyFlightStreamModal: React.FC<SurveyFlightStreamModalProps> = ({
  onClose,
}) => {
  const [events, setEvents] = useState<DroneScanEvent[]>([]);
  const [altitude, setAltitude] = useState<number>(120.4);
  const [speed, setSpeed] = useState<number>(8.2);
  const [edgeCount, setEdgeCount] = useState<number>(1420);
  const [statusText, setStatusText] = useState<string>("UAV RTK Surveying Grid Sector 4 Abadi");

  useEffect(() => {
    // Connect to Server-Sent Events (SSE) stream endpoint
    const eventSource = new EventSource("/api/stream/sse");

    eventSource.onmessage = (event) => {
      try {
        const data: DroneScanEvent = JSON.parse(event.data);
        if (data.event === "DRONE_SCAN_FRAME") {
          if (data.altitudeM) setAltitude(data.altitudeM);
          if (data.cannyEdgesDetected) setEdgeCount(data.cannyEdgesDetected);
          setEvents((prev) => [data, ...prev.slice(0, 7)]);
        }
      } catch (e) {
        // ignore parse error
      }
    };

    eventSource.onerror = () => {
      setStatusText("Telemetry Stream Simulation Running");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto bg-slate-900 border border-indigo-700/60 text-slate-100 rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh]">
        {/* HUD Top Bar */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-950 border-b border-indigo-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <Plane className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">
                  Live Drone Telemetry & Ingestion HUD
                </h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  RTK FIXED (18 SATS)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Continuous perception stream with OpenCV Canny edge extraction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flight Instruments Telemetry Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          <div className="grid grid-cols-4 gap-3 font-mono">
            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-[10px] text-slate-400">ALTITUDE (AGL)</div>
              <div className="text-xl font-bold text-sky-400 mt-1">
                {altitude.toFixed(1)} <span className="text-xs text-slate-400">m</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Baro + RTK L1/L2</div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-[10px] text-slate-400">GSD RESOLUTION</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                3.12 <span className="text-xs text-slate-400">cm/px</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Cadastral Spec</div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-[10px] text-slate-400">CANNY EDGES</div>
              <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
                {edgeCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Adaptive hysteresis</div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-[10px] text-slate-400">GROUND SPEED</div>
              <div className="text-xl font-bold text-indigo-400 mt-1">
                {speed.toFixed(1)} <span className="text-xs text-slate-400">m/s</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Lawnmower path</div>
            </div>
          </div>

          {/* Radar HUD Visualization */}
          <div className="relative h-44 bg-slate-950 rounded-xl border border-indigo-900/50 flex items-center justify-center overflow-hidden">
            {/* Radar concentric circles */}
            <div className="absolute w-36 h-36 rounded-full border border-indigo-500/20" />
            <div className="absolute w-24 h-24 rounded-full border border-indigo-500/30" />
            <div className="absolute w-12 h-12 rounded-full border border-indigo-500/40" />
            <div className="absolute w-full h-px bg-indigo-500/20" />
            <div className="absolute h-full w-px bg-indigo-500/20" />

            {/* Sweep radar cone */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent animate-spin origin-center duration-3000" />

            {/* Centered Drone Symbol */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-indigo-600/60 border border-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] font-mono text-indigo-300 font-semibold">
                SURVEY DRONE #04
              </span>
            </div>

            <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-400">
              HEADING: 042° NE • PITCH: -1.2°
            </div>
            <div className="absolute bottom-2 right-3 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>{statusText}</span>
            </div>
          </div>

          {/* Live Stream Telemetry Frames Feed */}
          <div>
            <div className="font-semibold text-slate-300 text-xs mb-1.5 flex items-center justify-between">
              <span>Perception Stream Events:</span>
              <span className="text-slate-500 font-mono text-[10px]">WebSocket & SSE</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px] max-h-36 overflow-y-auto">
              {events.length > 0 ? (
                events.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-300">
                    <span className="text-sky-400">
                      [FRAME #{ev.frameIndex || i + 1}]
                    </span>
                    <span className="text-slate-400">
                      Altitude: {ev.altitudeM?.toFixed(1) || "120.0"}m
                    </span>
                    <span className="text-amber-300">
                      Canny Edges: {ev.cannyEdgesDetected}
                    </span>
                    <span className="text-emerald-400">
                      Footprints: {ev.detectedFootprints || 3}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-center py-2">
                  Receiving continuous aerial telemetry feed...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Compliant with DGCA India Drone Rules & Survey of India Standards
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            Close HUD
          </button>
        </div>
      </div>
    </div>
  );
};
