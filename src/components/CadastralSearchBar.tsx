import React, { useState, useMemo } from "react";
import { Search, MapPin, Building, X, Compass, ChevronRight } from "lucide-react";
import { Parcel } from "../types";

interface CadastralSearchBarProps {
  parcels: Parcel[];
  onSelectParcel: (parcel: Parcel) => void;
  onNavigateCoordinates?: (lat: number, lng: number) => void;
}

export const CadastralSearchBar: React.FC<CadastralSearchBarProps> = ({
  parcels,
  onSelectParcel,
  onNavigateCoordinates,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredParcels = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    // Check if coordinates entered: e.g. "12.98, 80.21"
    const coordMatch = q.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      return [];
    }

    return parcels.filter(
      (p) =>
        p.uprn.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        (p.surveyNumber && p.surveyNumber.toLowerCase().includes(q)) ||
        (p.village && p.village.toLowerCase().includes(q)) ||
        (p.taluk && p.taluk.toLowerCase().includes(q)) ||
        (p.district && p.district.toLowerCase().includes(q))
    );
  }, [query, parcels]);

  const handleCoordinateSearch = () => {
    const q = query.trim();
    const coordMatch = q.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch && onNavigateCoordinates) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      onNavigateCoordinates(lat, lng);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-sm">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCoordinateSearch();
              if (filteredParcels.length > 0) {
                onSelectParcel(filteredParcels[0]);
                setIsOpen(false);
              }
            }
          }}
          placeholder="Search Survey No. (142), Village, Owner, or Lat, Lng..."
          className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder:text-slate-500 shadow-xl backdrop-blur-md focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-800/80 backdrop-blur-md">
          {filteredParcels.length > 0 ? (
            filteredParcels.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectParcel(p);
                  setIsOpen(false);
                }}
                className="p-2.5 hover:bg-slate-900 cursor-pointer transition flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-sky-400" />
                    <span>
                      {p.surveyNumber ? `Survey No. ${p.surveyNumber}/${p.subDivision || "1"}` : p.uprn}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      • {p.village || "Velachery"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Owner: {p.ownerName} • {Math.round(p.calculatedAreaSqMeters)} m²
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-slate-400 text-center">
              {query.match(/^-?\d+/) ? (
                <button
                  onClick={handleCoordinateSearch}
                  className="text-sky-400 font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Navigate to Coordinates ({query})</span>
                </button>
              ) : (
                "No cadastral records found matching query"
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
