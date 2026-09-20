import React, { useState, useEffect } from "react";
import { Search, MapPin, ChevronDown, Loader2, Building2, FileText, AlertCircle } from "lucide-react";
import type { District, Taluk, Village } from "../types/administrative";
import type { SelectedLandContext, AdministrativeSearchState } from "../types/context";

interface HierarchicalSearchProps {
  onContextChange: (context: SelectedLandContext) => void;
  onFreeSearch: (query: string) => void;
  existingContext?: SelectedLandContext | null;
}

export const HierarchicalSearch: React.FC<HierarchicalSearchProps> = ({
  onContextChange,
  onFreeSearch,
  existingContext,
}) => {
  const [searchState, setSearchState] = useState<AdministrativeSearchState>({
    districts: [],
    taluks: [],
    villages: [],
    selectedDistrict: null,
    selectedTaluk: null,
    selectedVillage: null,
    isLoading: false,
    error: null,
  });

  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedTaluk, setSelectedTaluk] = useState<string>("");
  const [selectedVillage, setSelectedVillage] = useState<string>("");
  const [surveyNumber, setSurveyNumber] = useState<string>("");
  const [subdivisionNumber, setSubdivisionNumber] = useState<string>("");
  const [freeSearchQuery, setFreeSearchQuery] = useState<string>("");
  const [isFreeSearchMode, setIsFreeSearchMode] = useState<boolean>(false);
  const [isSearchingFree, setIsSearchingFree] = useState<boolean>(false);

  // Load districts on mount
  useEffect(() => {
    loadDistricts();
  }, []);

  // Load taluks when district is selected
  useEffect(() => {
    if (selectedDistrict) {
      loadTaluks(selectedDistrict);
    } else {
      setSearchState((prev: AdministrativeSearchState) => ({ ...prev, taluks: [], selectedTaluk: null }));
      setSelectedTaluk("");
    }
  }, [selectedDistrict]);

  // Load villages when taluk is selected
  useEffect(() => {
    if (selectedTaluk) {
      loadVillages(selectedTaluk);
    } else {
      setSearchState((prev: AdministrativeSearchState) => ({ ...prev, villages: [], selectedVillage: null }));
      setSelectedVillage("");
    }
  }, [selectedTaluk]);

  const loadDistricts = async () => {
    setSearchState((prev: AdministrativeSearchState) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch('/api/admin/districts');
      const data = await response.json();
      setSearchState((prev: AdministrativeSearchState) => ({
        ...prev,
        districts: data.districts || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load districts:', error);
      setSearchState((prev: AdministrativeSearchState) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load districts',
      }));
    }
  };

  const loadTaluks = async (districtId: string) => {
    setSearchState((prev: AdministrativeSearchState) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`/api/admin/districts/${districtId}/taluks`);
      const data = await response.json();
      setSearchState((prev: AdministrativeSearchState) => ({
        ...prev,
        taluks: data.taluks || [],
        selectedTaluk: data.taluks?.[0] || null,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load taluks:', error);
      setSearchState((prev: AdministrativeSearchState) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load taluks',
      }));
    }
  };

  const loadVillages = async (talukId: string) => {
    setSearchState((prev: AdministrativeSearchState) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`/api/admin/taluks/${talukId}/villages`);
      const data = await response.json();
      setSearchState((prev: AdministrativeSearchState) => ({
        ...prev,
        villages: data.villages || [],
        selectedVillage: data.villages?.[0] || null,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load villages:', error);
      setSearchState((prev: AdministrativeSearchState) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load villages',
      }));
    }
  };

  const handleLoadLandContext = async () => {
    if (!selectedDistrict) {
      alert('Please select a district');
      return;
    }

    const context: SelectedLandContext = {
      contextId: `CTX-${Date.now()}`,
      district: searchState.selectedDistrict ? {
        id: searchState.selectedDistrict.id,
        name: searchState.selectedDistrict.name,
        nameTamil: searchState.selectedDistrict.nameTamil,
      } : undefined,
      taluk: searchState.selectedTaluk ? {
        id: searchState.selectedTaluk.id,
        name: searchState.selectedTaluk.name,
        nameTamil: searchState.selectedTaluk.nameTamil,
      } : undefined,
      village: searchState.selectedVillage ? {
        id: searchState.selectedVillage.id,
        name: searchState.selectedVillage.name,
        nameTamil: searchState.selectedVillage.nameTamil,
      } : undefined,
      surveyNumber: surveyNumber || undefined,
      subdivisionNumber: subdivisionNumber || undefined,
      dataAvailability: [
        { recordType: 'PATTA', status: 'REQUIRES_AUTHORIZATION', source: 'TamilNilam' },
        { recordType: 'CHITTA', status: 'REQUIRES_AUTHORIZATION', source: 'TamilNilam' },
        { recordType: 'A_REGISTER', status: 'REQUIRES_AUTHORIZATION', source: 'TamilNilam' },
        { recordType: 'FMB_SKETCH', status: 'REQUIRES_IMPORT', source: 'Survey & Land Records' },
        { recordType: 'TSLR', status: 'PARTIAL', source: 'TamilNilam Urban' },
        { recordType: 'TSLR_SKETCH', status: 'REQUIRES_IMPORT', source: 'TamilNilam Urban' },
        { recordType: 'HISTORICAL_RECORD', status: 'REQUIRES_IMPORT', source: 'Archival Records' },
      ],
      sourceMetadata: [
        {
          sourceId: 'TN-TAMILNILAM',
          sourceName: 'TamilNilam',
          organization: 'Government of Tamil Nadu',
          sourceType: 'OFFICIAL',
          accessMethod: 'AUTHORIZED',
          status: 'REQUIRES_AUTHORIZATION',
          sourceUrl: 'https://cla.tn.gov.in',
          notes: 'Official Tamil Nadu land record system'
        },
        {
          sourceId: 'TN-TNGIS',
          sourceName: 'TNGIS',
          organization: 'Government of Tamil Nadu',
          sourceType: 'OFFICIAL',
          accessMethod: 'AUTHORIZED',
          status: 'REQUIRES_AUTHORIZATION',
          sourceUrl: 'https://deg.tn.gov.in',
          notes: 'Tamil Nadu Geographical Information System'
        },
      ],
    };

    onContextChange(context);
  };

  const handleFreeSearch = async () => {
    if (!freeSearchQuery.trim()) {
      return;
    }

    setIsSearchingFree(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(freeSearchQuery)}`);
      const data = await response.json();
      
      if (data.location) {
        onFreeSearch(freeSearchQuery);
        // Try to resolve administrative context
        if (data.administrativeContext) {
          setSelectedDistrict(data.administrativeContext.districtId || "");
          if (data.administrativeContext.talukId) {
            setSelectedTaluk(data.administrativeContext.talukId);
          }
          if (data.administrativeContext.villageId) {
            setSelectedVillage(data.administrativeContext.villageId);
          }
        }
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      alert('Failed to resolve location. Please try administrative search.');
    } finally {
      setIsSearchingFree(false);
    }
  };

  return (
    <div className="absolute top-3.5 right-4 z-30 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-slate-950/60 max-w-md">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">SEARCH PLOTS</span>
          </div>
          <button
            onClick={() => setIsFreeSearchMode(!isFreeSearchMode)}
            className={`text-xs px-2 py-1 rounded-lg transition ${
              isFreeSearchMode
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
            }`}
          >
            {isFreeSearchMode ? 'Hierarchical' : 'Free Search'}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {isFreeSearchMode ? (
            /* Free Geographic Search */
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={freeSearchQuery}
                  onChange={(e) => setFreeSearchQuery(e.target.value)}
                  placeholder="Enter locality (e.g., Villivakkam, Ambattur...)"
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <button
                  onClick={handleFreeSearch}
                  disabled={isSearchingFree || !freeSearchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                >
                  {isSearchingFree ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>Free search provides geographic context. For land records, use hierarchical search.</span>
              </div>
            </div>
          ) : (
            /* Hierarchical Administrative Search */
            <div className="space-y-3">
              {/* District Dropdown */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium mb-1 block">
                  DISTRICT
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">Select District</option>
                  {searchState.districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name} ({district.nameTamil})
                    </option>
                  ))}
                </select>
              </div>

              {/* Taluk Dropdown */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium mb-1 block">
                  TALUK
                </label>
                <select
                  value={selectedTaluk}
                  onChange={(e) => setSelectedTaluk(e.target.value)}
                  disabled={!selectedDistrict || searchState.isLoading}
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Taluk</option>
                  {searchState.taluks.map((taluk) => (
                    <option key={taluk.id} value={taluk.id}>
                      {taluk.name} ({taluk.nameTamil})
                    </option>
                  ))}
                </select>
              </div>

              {/* Village Dropdown */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium mb-1 block">
                  VILLAGE
                </label>
                <select
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  disabled={!selectedTaluk || searchState.isLoading}
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Village</option>
                  {searchState.villages.map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name} ({village.nameTamil})
                    </option>
                  ))}
                </select>
              </div>

              {/* Survey Number */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium mb-1 block">
                  SURVEY NUMBER
                </label>
                <input
                  type="text"
                  value={surveyNumber}
                  onChange={(e) => setSurveyNumber(e.target.value)}
                  placeholder="e.g., 142"
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Subdivision Number */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium mb-1 block">
                  SUBDIVISION
                </label>
                <input
                  type="text"
                  value={subdivisionNumber}
                  onChange={(e) => setSubdivisionNumber(e.target.value)}
                  placeholder="e.g., 1A"
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Load Button */}
              <button
                onClick={handleLoadLandContext}
                disabled={!selectedDistrict || searchState.isLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {searchState.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    Load Land Records
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {searchState.error && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
              <AlertCircle className="w-3 h-3" />
              {searchState.error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};