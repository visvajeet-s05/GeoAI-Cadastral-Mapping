import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  X,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Maximize2,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Compass,
} from "lucide-react";
import {
  ActiveRasterLayerConfig,
  RasterSpatialMetadata,
  RasterUploadResponse,
} from "../../types/raster";
import { SUPPORTED_EPSG_SYSTEMS } from "../../lib/projections";

interface IngestOrthoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRaster: ActiveRasterLayerConfig | null;
  onApplyRasterLayer: (config: ActiveRasterLayerConfig) => void;
  onZoomToExtent?: () => void;
}

export const IngestOrthoModal: React.FC<IngestOrthoModalProps> = ({
  isOpen,
  onClose,
  activeRaster,
  onApplyRasterLayer,
  onZoomToExtent,
}) => {
  // Upload & File state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedEpsg, setSelectedEpsg] = useState<number>(32644); // Default to Tamil Nadu UTM Zone 44N
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMetadata, setSuccessMetadata] = useState<RasterSpatialMetadata | null>(null);

  // Active Layer Controls
  const [layerOpacity, setLayerOpacity] = useState<number>(
    activeRaster ? activeRaster.opacity : 0.85
  );
  const [layerVisible, setLayerVisible] = useState<boolean>(
    activeRaster ? activeRaster.visible : true
  );
  const [colorSymbology, setColorSymbology] = useState<
    "NATURAL_RGB" | "INFRARED" | "FALSE_COLOR" | "ELEVATION_RAMP"
  >(activeRaster ? activeRaster.colorSymbology : "NATURAL_RGB");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "tif" && ext !== "tiff" && ext !== "cog") {
      setErrorMessage(
        "Unsupported raster file format. Please upload a GeoTIFF (.tif, .tiff, or .cog)."
      );
      return;
    }
    setSelectedFile(file);
    setSuccessMetadata(null);
  };

  // Perform upload to Express server /api/raster/upload
  const handleUploadRaster = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a GeoTIFF file first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("raster", selectedFile);
      formData.append("epsg", selectedEpsg.toString());

      // Use XMLHttpRequest for real progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/raster/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 90);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data: RasterUploadResponse = JSON.parse(xhr.responseText);
            if (data.success && data.metadata) {
              setUploadProgress(100);
              setSuccessMetadata(data.metadata);

              // Automatically build and apply active raster layer
              const newConfig: ActiveRasterLayerConfig = {
                id: data.metadata.rasterId,
                name: data.metadata.filename,
                tileUrlTemplate: data.metadata.tileUrlTemplate,
                bounds: data.metadata.geographicBounds,
                center: data.metadata.center,
                opacity: layerOpacity,
                visible: layerVisible,
                epsg: data.metadata.epsg,
                gsdMeters: data.metadata.gsdMeters,
                resolution: [data.metadata.width, data.metadata.height],
                colorSymbology,
              };

              onApplyRasterLayer(newConfig);
            } else {
              setErrorMessage(data.message || "Failed to process raster header tags.");
            }
          } catch {
            setErrorMessage("Invalid server response format.");
          }
        } else {
          setErrorMessage(`Upload failed with server status ${xhr.status}: ${xhr.statusText}`);
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setErrorMessage("Network error during GeoTIFF upload.");
      };

      xhr.send(formData);
    } catch (err: unknown) {
      setIsUploading(false);
      setErrorMessage(
        err instanceof Error ? err.message : "Unexpected error during upload"
      );
    }
  };

  // Quick Load Demo Sample Raster (Thiruvanmiyur Block 12, GSD 1.8cm/px)
  const handleLoadDemoRaster = async () => {
    setIsUploading(true);
    setUploadProgress(40);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/raster/sample_uav_thiruvanmiyur/metadata");
      const data = await res.json();
      setIsUploading(false);
      setUploadProgress(100);

      if (data.success && data.metadata) {
        setSuccessMetadata(data.metadata);
        const demoConfig: ActiveRasterLayerConfig = {
          id: data.metadata.rasterId,
          name: data.metadata.filename,
          tileUrlTemplate: data.metadata.tileUrlTemplate,
          bounds: data.metadata.geographicBounds,
          center: data.metadata.center,
          opacity: layerOpacity,
          visible: true,
          epsg: data.metadata.epsg,
          gsdMeters: data.metadata.gsdMeters,
          resolution: [data.metadata.width, data.metadata.height],
          colorSymbology: "NATURAL_RGB",
        };

        onApplyRasterLayer(demoConfig);
      }
    } catch {
      setIsUploading(false);
      setErrorMessage("Could not load demo raster.");
    }
  };

  // Apply modified layer controls (Opacity, Visibility, Symbology)
  const handleUpdateControls = (
    newOpacity: number,
    newVisible: boolean,
    newSymbology: "NATURAL_RGB" | "INFRARED" | "FALSE_COLOR" | "ELEVATION_RAMP"
  ) => {
    setLayerOpacity(newOpacity);
    setLayerVisible(newVisible);
    setColorSymbology(newSymbology);

    if (activeRaster) {
      onApplyRasterLayer({
        ...activeRaster,
        opacity: newOpacity,
        visible: newVisible,
        colorSymbology: newSymbology,
      });
    }
  };

  return (
    <div
      id="ingest-ortho-modal"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Cloud-Optimized GeoTIFF (COG) Ingest Engine
              </h2>
              <p className="text-xs text-slate-400">
                Pyramid XYZ Tiling, Reprojection, and High-Resolution Orthomosaics
              </p>
            </div>
          </div>

          <button
            id="btn-close-ingest-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Active Layer Status & Quick Controls */}
          {activeRaster && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-xs">
                    {activeRaster.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    GSD: {(activeRaster.gsdMeters * 100).toFixed(1)} cm/px
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onZoomToExtent && (
                    <button
                      id="btn-zoom-raster-extent"
                      onClick={onZoomToExtent}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
                      title="Fit Map to Raster Extent"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Zoom to Extent</span>
                    </button>
                  )}

                  <button
                    id="btn-toggle-raster-visibility"
                    onClick={() =>
                      handleUpdateControls(layerOpacity, !layerVisible, colorSymbology)
                    }
                    className={`p-1.5 rounded-lg text-xs transition border ${
                      layerVisible
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                    title={layerVisible ? "Hide Layer" : "Show Layer"}
                  >
                    {layerVisible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    <span>Layer Opacity</span>
                  </span>
                  <span className="font-mono text-slate-200">
                    {Math.round(layerOpacity * 100)}%
                  </span>
                </div>
                <input
                  id="slider-raster-opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layerOpacity}
                  onChange={(e) =>
                    handleUpdateControls(
                      parseFloat(e.target.value),
                      layerVisible,
                      colorSymbology
                    )
                  }
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Color Symbology Selector */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 shrink-0">Symbology:</span>
                <div className="grid grid-cols-4 gap-1.5 w-full text-[11px] font-medium">
                  {(
                    [
                      ["NATURAL_RGB", "Natural RGB"],
                      ["INFRARED", "Color IR"],
                      ["FALSE_COLOR", "Vegetation"],
                      ["ELEVATION_RAMP", "Elev Ramp"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() =>
                        handleUpdateControls(layerOpacity, layerVisible, mode)
                      }
                      className={`px-2 py-1 rounded-md text-center transition border ${
                        colorSymbology === mode
                          ? "bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm"
                          : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div
            id="dropzone-raster-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? "border-sky-400 bg-sky-500/10 scale-[1.01]"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-950/10"
                : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".tif,.tiff,.cog"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div
              className={`p-3 rounded-2xl ${
                selectedFile
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {selectedFile ? (
                <FileImage className="w-8 h-8" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            <div>
              {selectedFile ? (
                <div>
                  <div className="text-sm font-semibold text-emerald-300">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to
                    ingest
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    Drag and drop your GeoTIFF or COG file
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Supports .tif, .tiff, and .cog (WGS84, UTM 44N, Web Mercator)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EPSG Coordinate System Override */}
          <div className="space-y-1.5">
            <label
              htmlFor="select-epsg-override"
              className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Spatial Reference System (EPSG Override)</span>
            </label>
            <select
              id="select-epsg-override"
              value={selectedEpsg}
              onChange={(e) => setSelectedEpsg(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {SUPPORTED_EPSG_SYSTEMS.map((epsg) => (
                <option key={epsg.code} value={epsg.code}>
                  EPSG:{epsg.code} — {epsg.name} ({epsg.areaOfUse})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-400" />
              <span>
                Defaulting to EPSG:32644 (UTM Zone 44N) for Tamil Nadu &amp; South India
                cadastral orthomosaics.
              </span>
            </p>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300 font-mono">
                <span>Ingesting &amp; Reprojecting Tiles...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extracted Metadata Card */}
          {successMetadata && (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Raster Successfully Ingested &amp; Reprojected</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300">
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Dimensions</div>
                  <div>
                    {successMetadata.width} × {successMetadata.height} px
                  </div>
                </div>
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Resolution GSD</div>
                  <div>{(successMetadata.gsdMeters * 100).toFixed(1)} cm/px</div>
                </div>
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Projection</div>
                  <div>EPSG:{successMetadata.epsg}</div>
                </div>
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Bands</div>
                  <div>
                    {successMetadata.bands} ({successMetadata.colorModel})
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            id="btn-load-demo-raster"
            onClick={handleLoadDemoRaster}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/20 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Ortho (1.8cm GSD)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-raster-ingest"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              id="btn-submit-raster-ingest"
              onClick={handleUploadRaster}
              disabled={!selectedFile || isUploading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-sky-600/30"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isUploading ? "Processing..." : "Ingest & Mount Raster"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
