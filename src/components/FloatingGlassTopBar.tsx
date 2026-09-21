import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  MapPin,
  Layers,
  FileText,
  Plane,
  AlertTriangle,
  Zap,
  Search,
  CheckCircle2,
  Radio,
  Sliders,
  Sparkles,
  Download,
  X,
  Globe,
  Compass,
  Loader2,
  Navigation
} from "lucide-react";
import { ActiveLayers, Parcel, UAVTelemetry } from "../types";

export interface AreaSuggestion {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: "CHENNAI" | "TAMIL_NADU" | "INDIA" | "GLOBAL";
  district?: string;
  state?: string;
  country?: string;
  description?: string;
}

interface FloatingGlassTopBarProps {
  activeLayers: ActiveLayers;
  onToggleLayer: (layer: keyof ActiveLayers) => void;
  parcelsCount: number;
  telemetry: UAVTelemetry | null;
  isSimulatingFlight: boolean;
  onToggleFlightSimulation: () => void;
  onOpenDualStreamCockpit: () => void;
  onOpenBlueprintModal: () => void;
  onOpenIngestModal: () => void;
  onExportGeoJSON: () => void;
  onTriggerTestMode: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  parcels: Parcel[];
  onSelectParcel: (parcel: Parcel) => void;
  onSearchArea?: (
    query: string,
    presetCoords?: { lat: number; lon: number; name?: string; zoom?: number }
  ) => Promise<any> | void;
  currentLocationName?: string;
  onResetGranularDemo?: () => void;
  onScanUnderSegmentation?: () => void;
  isHierarchicalSearchOpen?: boolean;
  onToggleHierarchicalSearch?: () => void;
  isLayerControlOpen?: boolean;
  onToggleLayerControl?: () => void;
}

export const FloatingGlassTopBar: React.FC<FloatingGlassTopBarProps> = ({
  activeLayers,
  onToggleLayer,
  parcelsCount,
  telemetry,
  isSimulatingFlight,
  onToggleFlightSimulation,
  onOpenDualStreamCockpit,
  onOpenBlueprintModal,
  onOpenIngestModal,
  onExportGeoJSON,
  onTriggerTestMode,
  searchQuery,
  onSearchChange,
  parcels,
  onSelectParcel,
  onSearchArea,
  currentLocationName = "Velachery Town (S.No. 142)",
  onResetGranularDemo,
  onScanUnderSegmentation,
  isHierarchicalSearchOpen,
  onToggleHierarchicalSearch,
  isLayerControlOpen,
  onToggleLayerControl,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick Curated Hubs for 1-click Navigation
  const QUICK_GLOBAL_HUBS: AreaSuggestion[] = [
    { id: "vel", name: "Velachery (S.No. 142)", lat: 12.9839, lon: 80.2090, category: "CHENNAI", description: "Standard Core Dataset" },
    { id: "gui", name: "Guindy Industrial", lat: 13.0067, lon: 80.2025, category: "CHENNAI", description: "Commercial & Light Industry" },
    { id: "ady", name: "Adyar Riverfront", lat: 13.0012, lon: 80.2565, category: "CHENNAI", description: "Riparian Cadastral Buffer" },
    { id: "tng", name: "T. Nagar Commercial", lat: 13.0418, lon: 80.2341, category: "CHENNAI", description: "High-Density Commercial Blocks" },
    { id: "omr", name: "OMR Tech Corridor", lat: 12.9010, lon: 80.2279, category: "CHENNAI", description: "IT SEZ & Campus Grid" },
    { id: "blr", name: "Bengaluru Tech Park", lat: 12.9716, lon: 77.5946, category: "INDIA", description: "Electronic City & Indiranagar" },
    { id: "hyd", name: "Hyderabad Hitec City", lat: 17.4435, lon: 78.3772, category: "INDIA", description: "Cyberabad Commercial" },
    { id: "mum", name: "Mumbai BKC & Nariman", lat: 19.0657, lon: 72.8687, category: "INDIA", description: "Financial Capital Skyline" },
    { id: "del", name: "New Delhi Central Vista", lat: 28.6315, lon: 77.2167, category: "INDIA", description: "Connaught Place Grid" },
    { id: "lon", name: "London Westminster", lat: 51.4995, lon: -0.1248, category: "GLOBAL", description: "HM Land Registry Sector" },
    { id: "nyc", name: "New York Manhattan", lat: 40.7580, lon: -73.9855, category: "GLOBAL", description: "Borough Tax Block & Lot" },
    { id: "tyo", name: "Tokyo Shinjuku", lat: 35.6938, lon: 139.7034, category: "GLOBAL", description: "Dense Japanese Chome" },
    { id: "dxb", name: "Dubai Downtown", lat: 25.1972, lon: 55.2744, category: "GLOBAL", description: "Burj Master Plan Sector" },
    { id: "sin", name: "Singapore Marina Bay", lat: 1.2838, lon: 103.8591, category: "GLOBAL", description: "SLA 3D Strata Registry" },
  ];

  // Fetch real-time suggestions as user types
  useEffect(() => {
    if (!isSearchOpen) return;

    const timer = setTimeout(async () => {
      try {
        const query = searchQuery.trim();
        const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (err) {
        // Fallback to local filtering
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchOpen]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter local parcels currently in memory
  const filteredParcels = searchQuery.trim()
    ? parcels.filter(
        (p) =>
          p.uprn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.surveyNumber && p.surveyNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  // Check if input looks like coordinates (e.g. "13.08, 80.27")
  const coordRegex = /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/;
  const coordMatch = searchQuery.trim().match(coordRegex);

  // Execute Search: Realtime Live Location Change
  const handleExecuteSearch = async (
    query: string,
    preset?: { lat: number; lon: number; name?: string; zoom?: number }
  ) => {
    if (!query.trim() && !preset) return;
    setIsSearchingLocation(true);

    try {
      if (onSearchArea) {
        await onSearchArea(query, preset);
      }
      setIsSearchOpen(false);
    } catch (err) {
      console.error("Failed to navigate to location:", err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If there is an exact first suggestion, use it, or search query directly
      if (suggestions.length > 0 && searchQuery.trim().length > 1) {
        handleExecuteSearch(suggestions[0].name, {
          lat: suggestions[0].lat,
          lon: suggestions[0].lon,
          name: suggestions[0].name,
        });
      } else {
        handleExecuteSearch(searchQuery);
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  return (
    <header className="w-full shrink-0 z-30 select-none bg-slate-900/95 backdrop-blur-2xl border-b border-white/10 px-4 py-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 shadow-md shadow-slate-950/60">
      {/* Left: Brand Identity & Active Sector Badge */}
      <div className="flex items-center gap-2.5 shrink-0 justify-self-start">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-tight text-white font-mono">
              GEOTRACE<span className="text-cyan-400">-AI</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              GLOBAL CADASTRE
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono truncate max-w-[210px] sm:max-w-[280px]">
            <MapPin className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span className="truncate text-slate-300 font-semibold" title={currentLocationName}>
              {currentLocationName}
            </span>
          </div>
        </div>
      </div>

      {/* Center / Navigation: Layer & Feature Mode Toggles */}
      <nav className="hidden md:flex items-center justify-center gap-1.5 text-xs shrink-0 justify-self-center px-2">
        {/* 1. Vector Boundaries */}
        <button
          onClick={() => onToggleLayer("vectorBoundaries")}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeLayers.vectorBoundaries
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>Parcels ({parcelsCount})</span>
        </button>

        {/* 2. Historical Blueprint */}
        <button
          onClick={() => onToggleLayer("legalGovLayout")}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeLayers.legalGovLayout
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>FMB Blueprint</span>
        </button>

        {/* 3. Discrepancy Heatmap */}
        <button
          onClick={() => onToggleLayer("discrepancyOverlay")}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeLayers.discrepancyOverlay
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Discrepancies</span>
        </button>

        {/* 4. Simulated UAV Drone Stream */}
        <button
          onClick={onToggleFlightSimulation}
          className={`px-2.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
            isSimulatingFlight
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30"
              : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60"
          }`}
        >
          <Plane className="w-3.5 h-3.5 shrink-0" />
          <span>{isSimulatingFlight ? "UAV Active" : "Simulate UAV"}</span>
          {isSimulatingFlight && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
        </button>

        {/* 5. Dual-Stream Cadastral AI Cockpit Trigger */}
        <button
          onClick={onOpenDualStreamCockpit}
          className="px-3 py-1.5 rounded-xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white shadow-md shadow-sky-600/30 border border-sky-400/30 transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
          <span>Dual-Stream AI</span>
        </button>
      </nav>

      {/* Right: Quick Tools & Realtime Search Bar */}
      <div className="flex items-center gap-1.5 shrink-0 justify-self-end">
        {/* 1. Map Layers Drawer Toggle */}
        {onToggleLayerControl && (
          <button
            onClick={onToggleLayerControl}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1.5 whitespace-nowrap ${
              isLayerControlOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
            }`}
            title="Toggle Map Layers Drawer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">Layers</span>
          </button>
        )}

        {/* 2. Hierarchical Search Drawer Toggle */}
        {onToggleHierarchicalSearch && (
          <button
            onClick={onToggleHierarchicalSearch}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1.5 whitespace-nowrap ${
              isHierarchicalSearchOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
            }`}
            title="Search Land Records & Administrative Hierarchy"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden md:inline">Search Records</span>
          </button>
        )}

        {/* 3. Realtime Live Global Search Bar & Quick Plots */}
        <div className="relative">
          {isSearchOpen ? (
            <div className="flex items-center bg-slate-950/95 border border-cyan-500/60 rounded-xl px-2.5 py-1.5 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/30">
              {isSearchingLocation ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin mr-1.5 shrink-0" />
              ) : (
                <Search className="w-3.5 h-3.5 text-cyan-400 mr-1.5 shrink-0" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search any area, city or plot..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-400 focus:outline-none w-44 sm:w-64 md:w-72 font-mono"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  className="p-0.5 text-slate-400 hover:text-white mr-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                }}
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-mono px-1.5"
                title="Close Search"
              >
                ESC
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-2 text-xs font-mono border border-white/10 hover:border-cyan-500/40 whitespace-nowrap shadow-sm"
              title="Search any area globally or filter plots"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline">Search Any Area</span>
              <kbd className="hidden lg:inline text-[9px] bg-slate-900 border border-slate-700 px-1 rounded text-slate-400 font-mono">
                Live
              </kbd>
            </button>
          )}

          {/* Search Dropdown Results & Global Hubs */}
          {isSearchOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-11 right-0 bg-slate-900/98 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-2xl p-3 w-80 sm:w-96 max-h-[80vh] overflow-y-auto space-y-3 z-50 text-xs animate-in fade-in slide-in-from-top-2"
            >
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono scrollbar-none">
                {["ALL", "CHENNAI", "INDIA", "GLOBAL", "PLOTS"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-2 py-0.5 rounded-lg border whitespace-nowrap transition ${
                      activeCategoryFilter === cat
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                        : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    {cat === "ALL" ? "All Results" : cat}
                  </button>
                ))}
              </div>

              {/* Direct Coordinate Trigger */}
              {coordMatch && (
                <div
                  onClick={() => {
                    const lat = parseFloat(coordMatch[1]);
                    const lon = parseFloat(coordMatch[2]);
                    handleExecuteSearch(searchQuery, {
                      lat,
                      lon,
                      name: `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
                    });
                  }}
                  className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 hover:bg-cyan-900/50 cursor-pointer flex items-center justify-between transition group"
                >
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
                    <div>
                      <div className="font-bold text-cyan-200">Fly to Coordinates</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {coordMatch[1]}, {coordMatch[2]} • Relocate Cadastral Grid
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-cyan-500 text-slate-950">
                    FLY NOW
                  </span>
                </div>
              )}

              {/* Real-Time Area Geocode Suggestions */}
              {suggestions.length > 0 && activeCategoryFilter !== "PLOTS" && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-cyan-400" /> Realtime Locations
                    </span>
                    <span className="text-[9px] text-slate-500">Click to fly & generate grid</span>
                  </div>
                  <div className="space-y-1">
                    {suggestions
                      .filter(
                        (s) =>
                          activeCategoryFilter === "ALL" || s.category === activeCategoryFilter
                      )
                      .slice(0, 6)
                      .map((s) => (
                        <div
                          key={s.id}
                          onClick={() =>
                            handleExecuteSearch(s.name, {
                              lat: s.lat,
                              lon: s.lon,
                              name: s.name,
                            })
                          }
                          className="p-2 rounded-xl hover:bg-slate-800/90 cursor-pointer flex items-center justify-between transition border border-transparent hover:border-cyan-500/30 group"
                        >
                          <div className="flex-1 pr-2 min-w-0">
                            <div className="font-bold text-white group-hover:text-cyan-300 truncate">
                              {s.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {s.description || `${s.district ? s.district + ", " : ""}${s.state || ""}`}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              s.category === "GLOBAL"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : s.category === "CHENNAI"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {s.category}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Cadastral Plots In Current Location */}
              {filteredParcels.length > 0 &&
                (activeCategoryFilter === "ALL" || activeCategoryFilter === "PLOTS") && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-emerald-400" /> Current Sector Plots
                      </span>
                      <span className="text-[9px] text-slate-500">{filteredParcels.length} found</span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {filteredParcels.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            onSelectParcel(p);
                            setIsSearchOpen(false);
                          }}
                          className="p-2 rounded-xl hover:bg-slate-800 cursor-pointer flex items-center justify-between transition border border-transparent hover:border-emerald-500/30"
                        >
                          <div>
                            <div className="font-bold text-white font-mono">{p.uprn}</div>
                            <div className="text-[10px] text-slate-400">
                              {p.ownerName} &bull; S.No {p.surveyNumber || "101"}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-300 font-bold">
                            {Math.round(p.calculatedAreaSqMeters)} m²
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Curated Global & Regional Quick Navigation Pills */}
              {!searchQuery.trim() && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-cyan-400" /> Quick Cadastral Hubs (1-Click Fly)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_GLOBAL_HUBS.map((hub) => (
                      <button
                        key={hub.id}
                        onClick={() =>
                          handleExecuteSearch(hub.name, {
                            lat: hub.lat,
                            lon: hub.lon,
                            name: hub.name,
                          })
                        }
                        className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 text-left transition flex flex-col justify-between"
                      >
                        <div className="font-bold text-white text-[11px] truncate">{hub.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                          <span className="truncate">{hub.description}</span>
                          <span
                            className={`ml-1 text-[8px] px-1 rounded ${
                              hub.category === "GLOBAL"
                                ? "text-purple-300 bg-purple-500/10"
                                : "text-cyan-300 bg-cyan-500/10"
                            }`}
                          >
                            {hub.category}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Freeform Search Prompt */}
              {searchQuery.trim() && (
                <div
                  onClick={() => handleExecuteSearch(searchQuery)}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-900/30 border border-white/10 hover:border-cyan-500/40 cursor-pointer flex items-center justify-between text-xs transition"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Search global map for &quot;<strong className="text-cyan-300">{searchQuery}</strong>&quot;
                    </span>
                  </div>
                  <kbd className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-300">
                    ↵ Enter
                  </kbd>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
