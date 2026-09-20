import React from "react";
import { Layers, Eye, EyeOff, ChevronDown, ChevronRight, X } from "lucide-react";
import type { MapLayerConfig } from "../types/context";

interface LayerControlProps {
  layers: MapLayerConfig[];
  onToggleLayer: (layerId: string) => void;
  onToggleGroup?: (groupType: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  layers,
  onToggleLayer,
  onToggleGroup,
  isOpen = true,
  onClose,
}) => {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(['ADMINISTRATIVE', 'CADASTRAL'])
  );

  if (!isOpen) return null;

  const groupedLayers = layers.reduce((acc, layer) => {
    if (!acc[layer.type]) {
      acc[layer.type] = [];
    }
    acc[layer.type].push(layer);
    return acc;
  }, {} as Record<string, MapLayerConfig[]>);

  const toggleGroup = (groupType: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupType)) {
      newExpanded.delete(groupType);
    } else {
      newExpanded.add(groupType);
    }
    setExpandedGroups(newExpanded);
  };

  const getGroupLabel = (type: string) => {
    switch (type) {
      case 'ADMINISTRATIVE':
        return 'Administrative Boundaries';
      case 'CADASTRAL':
        return 'Cadastral Data';
      case 'PHYSICAL':
        return 'Physical Features';
      case 'AI':
        return 'AI Analysis';
      case 'DISCREPANCY':
        return 'Discrepancies';
      default:
        return type;
    }
  };

  const getGroupColor = (type: string) => {
    switch (type) {
      case 'ADMINISTRATIVE':
        return 'text-purple-400';
      case 'CADASTRAL':
        return 'text-blue-400';
      case 'PHYSICAL':
        return 'text-green-400';
      case 'AI':
        return 'text-cyan-400';
      case 'DISCREPANCY':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="absolute top-20 left-18 z-30 pointer-events-auto transition-all animate-in fade-in slide-in-from-left-4">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-slate-950/70 w-72 max-w-xs overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white tracking-wide">MAP LAYERS</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Map Layers"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Layer Groups */}
        <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
          {Object.entries(groupedLayers).map(([groupType, groupLayers]) => (
            <div key={groupType} className="space-y-1">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupType)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/50 transition"
              >
                <span className={`text-xs font-bold ${getGroupColor(groupType)}`}>
                  {getGroupLabel(groupType)}
                </span>
                {expandedGroups.has(groupType) ? (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                )}
              </button>

              {/* Group Layers */}
              {expandedGroups.has(groupType) && (
                <div className="pl-3 space-y-1">
                  {groupLayers.map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => onToggleLayer(layer.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/50 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{
                            backgroundColor: layer.style.color,
                            border: `2px solid ${layer.style.color}`,
                          }}
                        />
                        <span className="text-xs text-slate-300">{layer.name}</span>
                      </div>
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/10">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Government</span>
            <span className="w-2 h-2 rounded-full bg-orange-500 ml-2"></span>
            <span>UAV</span>
            <span className="w-2 h-2 rounded-full bg-green-500 ml-2"></span>
            <span>Overlap</span>
            <span className="w-2 h-2 rounded-full bg-red-500 ml-2"></span>
            <span>Discrepancy</span>
          </div>
        </div>
      </div>
    </div>
  );
};