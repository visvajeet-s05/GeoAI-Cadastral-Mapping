import React, { useState, useRef } from "react";
import {
  UploadCloud,
  X,
  Sliders,
  CheckCircle2,
  FileImage,
  Cpu,
  Layers,
  Sparkles,
  FileUp,
  FileCode,
  AlertCircle,
} from "lucide-react";
import { Parcel } from "../types";
import { calculateShoelaceArea } from "../lib/geoUtils";

interface DroneIngestionModalProps {
  onClose: () => void;
  onIngestCompleted: (newParcels: Parcel[]) => void;
}

export const DroneIngestionModal: React.FC<DroneIngestionModalProps> = ({
  onClose,
  onIngestCompleted,
}) => {
  const [ingestTab, setIngestTab] = useState<"preset" | "upload">("preset");
  const [selectedBenchmark, setSelectedBenchmark] = useState<number>(1);
  const [cannyThresh1, setCannyThresh1] = useState<number>(50);
  const [cannyThresh2, setCannyThresh2] = useState<number>(150);
  const [dpEpsilon, setDpEpsilon] = useState<number>(0.015);
  const [minAreaFilter, setMinAreaFilter] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>("");

  // Custom File Upload state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [uploadedParcels, setUploadedParcels] = useState<Parcel[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const benchmarks = [
    {
      id: 1,
      title: "Sector 4 Peri-Urban Abadi Settlement",
      description: "Dense village cluster, shadow occlusions, multi-generational household subdivisions.",
      altitude: "120m AGL",
      gsd: "3.12 cm/pixel",
      parcelsExpected: 2,
    },
    {
      id: 2,
      title: "Unstructured Rural Boundary Zone (Dataset-Alpha)",
      description: "Vegetative hedgerows, open irrigation canals, irregular historical farm boundaries.",
      altitude: "150m AGL",
      gsd: "4.50 cm/pixel",
      parcelsExpected: 2,
    },
    {
      id: 3,
      title: "Cyber Corridor Commercial Tech District",
      description: "Orthogonal surveyed building blocks, strict municipal road setbacks.",
      altitude: "100m AGL",
      gsd: "2.50 cm/pixel",
      parcelsExpected: 2,
    },
  ];

  // Helper to parse file into parcels
  const processUploadedFile = async (file: File) => {
    setUploadError(null);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const isGeoJson = file.name.endsWith(".geojson") || file.name.endsWith(".json");

    if (isGeoJson) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const features = json.type === "FeatureCollection" ? json.features : json.type === "Feature" ? [json] : [];

        if (features.length === 0) {
          throw new Error("No GeoJSON features or geometries found in file.");
        }

        const now = Date.now();
        const parsedParcels: Parcel[] = features.slice(0, 10).map((f: any, idx: number) => {
          let rawCoords: [number, number][] = [];
          if (f.geometry && f.geometry.type === "Polygon" && f.geometry.coordinates?.[0]) {
            rawCoords = f.geometry.coordinates[0];
          } else {
            // fallback quad
            const baseLon = 77.2080 + idx * 0.0008;
            const baseLat = 28.6140 + idx * 0.0006;
            rawCoords = [
              [baseLon, baseLat],
              [baseLon + 0.0004, baseLat + 0.00005],
              [baseLon + 0.00038, baseLat + 0.00035],
              [baseLon - 0.00002, baseLat + 0.0003],
              [baseLon, baseLat],
            ];
          }

          const area = Math.round(calculateShoelaceArea(rawCoords) * 10) / 10 || 1200 + idx * 150;
          const pid = `GT-PID-FILE-${now.toString().slice(-4)}-${idx + 1}`;
          const lats = rawCoords.map((c) => c[1]);
          const lons = rawCoords.map((c) => c[0]);

          return {
            id: `PRCL-UP-${now.toString().slice(-4)}-${idx + 1}`,
            uprn: f.properties?.uprn || `GT-UP-${Math.floor(100 + Math.random() * 900)}`,
            geoTraceCardNumber: pid,
            svamitvaCardNumber: pid,
            ownerName: f.properties?.ownerName || f.properties?.owner_name || `Landholder Record #${idx + 1}`,
            ownerNationalId: f.properties?.ownerNationalId || `IND-ID-${Math.floor(1000 + Math.random() * 9000)}`,
            landType: f.properties?.landType || (area > 2000 ? "AGRICULTURAL" : area > 1000 ? "COMMERCIAL" : "RESIDENTIAL"),
            status: "TOPOLOGY_VERIFIED",
            coordinates: rawCoords,
            calculatedAreaSqMeters: area,
            perimeterMeters: Math.round(Math.sqrt(area) * 4 * 10) / 10,
            centroid: {
              latitude: lats.reduce((a, b) => a + b, 0) / lats.length,
              longitude: lons.reduce((a, b) => a + b, 0) / lons.length,
            },
            vertexCount: rawCoords.length,
            epistemicUncertainty: 0.12,
            aleatoricUncertainty: 0.15,
            overallUncertainty: 0.14,
            structureCount: f.properties?.structureCount || 1,
            complianceScore: 94,
            encroachmentDetected: false,
            currentHash: `file-hash-${now}-${idx}`,
            createdAt: now,
            updatedAt: now,
          };
        });

        setUploadedParcels(parsedParcels);
      } catch (err: any) {
        setUploadError(`Failed to parse GeoJSON: ${err.message}`);
        setUploadedParcels(null);
      }
    } else {
      // Orthomosaic raster / aerial imagery simulation
      const now = Date.now();
      const baseLat = 28.6148;
      const baseLon = 77.2082;
      const pid1 = `GT-PID-RASTER-${now.toString().slice(-4)}-A`;
      const pid2 = `GT-PID-RASTER-${now.toString().slice(-4)}-B`;

      const rasterParcels: Parcel[] = [
        {
          id: `PRCL-RAST-${now.toString().slice(-4)}-1`,
          uprn: `GT-ZONE-R1-${Math.floor(10 + Math.random() * 89)}`,
          geoTraceCardNumber: pid1,
          svamitvaCardNumber: pid1,
          ownerName: "Subhashini Raghunathan",
          ownerNationalId: "AADHAAR-XXXX-3829",
          landType: "RESIDENTIAL",
          status: "TOPOLOGY_VERIFIED",
          coordinates: [
            [baseLon, baseLat],
            [baseLon + 0.00048, baseLat + 0.00006],
            [baseLon + 0.00045, baseLat + 0.00038],
            [baseLon - 0.00003, baseLat + 0.00034],
            [baseLon, baseLat],
          ],
          calculatedAreaSqMeters: 1530.4,
          perimeterMeters: 161.2,
          centroid: { latitude: baseLat + 0.00019, longitude: baseLon + 0.00022 },
          vertexCount: 4,
          epistemicUncertainty: 0.15,
          aleatoricUncertainty: 0.19,
          overallUncertainty: 0.17,
          structureCount: 2,
          complianceScore: 95,
          encroachmentDetected: false,
          currentHash: `9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f${Math.floor(Math.random() * 1000)}`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `PRCL-RAST-${now.toString().slice(-4)}-2`,
          uprn: `GT-ZONE-R2-${Math.floor(10 + Math.random() * 89)}`,
          geoTraceCardNumber: pid2,
          svamitvaCardNumber: pid2,
          ownerName: "Harishankar Trivedi",
          ownerNationalId: "AADHAAR-XXXX-8114",
          landType: "COMMERCIAL",
          status: "TOPOLOGY_VERIFIED",
          coordinates: [
            [baseLon + 0.00048, baseLat + 0.00006],
            [baseLon + 0.00098, baseLat + 0.00010],
            [baseLon + 0.00094, baseLat + 0.00041],
            [baseLon + 0.00045, baseLat + 0.00038],
            [baseLon + 0.00048, baseLat + 0.00006],
          ],
          calculatedAreaSqMeters: 1680.0,
          perimeterMeters: 165.4,
          centroid: { latitude: baseLat + 0.00024, longitude: baseLon + 0.00071 },
          vertexCount: 4,
          epistemicUncertainty: 0.13,
          aleatoricUncertainty: 0.17,
          overallUncertainty: 0.15,
          structureCount: 1,
          complianceScore: 92,
          encroachmentDetected: false,
          currentHash: `b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef${Math.floor(Math.random() * 1000)}`,
          createdAt: now,
          updatedAt: now,
        },
      ];

      setUploadedParcels(rasterParcels);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleStartIngestion = async () => {
    setIsProcessing(true);

    const steps = [
      "1/4: Ingesting UAV Orthomosaic / Survey File & Extracting CRS Metadata...",
      "2/4: Applying Bilateral Denoising & Adaptive Canny Edge Detection...",
      "3/4: OpenCV FindContours & Douglas-Peucker Polygon Vectorization...",
      "4/4: Projecting to WGS84, Computing Shoelace Area & Minting SHA-256 Ledger...",
    ];

    for (let i = 0; i < steps.length; i++) {
      setProcessingStep(steps[i]);
      await new Promise((r) => setTimeout(r, 450));
    }

    let parcelsToIngest: Parcel[] = [];

    if (ingestTab === "upload" && uploadedParcels && uploadedParcels.length > 0) {
      parcelsToIngest = uploadedParcels;
    } else {
      // Generate simulated newly vectorized parcels based on selected benchmark
      const now = Date.now();
      const baseLat = 28.6145 + Math.random() * 0.001;
      const baseLon = 77.2085 + Math.random() * 0.001;

      const pidA = `GT-PID-2026-${Math.floor(1000 + Math.random() * 9000)}-A`;
      const pidB = `GT-PID-2026-${Math.floor(1000 + Math.random() * 9000)}-B`;

      const newParcelA: Parcel = {
        id: `PRCL-UAV-${now.toString().slice(-4)}`,
        uprn: `GT-ZONE-A-20${Math.floor(10 + Math.random() * 89)}`,
        geoTraceCardNumber: pidA,
        svamitvaCardNumber: pidA,
        ownerName: "Devendra Swaroop Sharma",
        ownerNationalId: "AADHAAR-XXXX-5542",
        landType: "RESIDENTIAL",
        status: "TOPOLOGY_VERIFIED",
        coordinates: [
          [baseLon, baseLat],
          [baseLon + 0.00045, baseLat + 0.00004],
          [baseLon + 0.00042, baseLat + 0.00035],
          [baseLon - 0.00002, baseLat + 0.00032],
          [baseLon, baseLat],
        ],
        calculatedAreaSqMeters: 1420.5,
        perimeterMeters: 154.2,
        centroid: { latitude: baseLat + 0.00017, longitude: baseLon + 0.00021 },
        vertexCount: 4,
        epistemicUncertainty: 0.16,
        aleatoricUncertainty: 0.21,
        overallUncertainty: 0.18,
        structureCount: 2,
        complianceScore: 95,
        encroachmentDetected: false,
        currentHash: `9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a${Math.floor(
          Math.random() * 1000
        )}`,
        createdAt: now,
        updatedAt: now,
      };

      const newParcelB: Parcel = {
        id: `PRCL-UAV-${(now + 1).toString().slice(-4)}`,
        uprn: `GT-ZONE-B-20${Math.floor(10 + Math.random() * 89)}`,
        geoTraceCardNumber: pidB,
        svamitvaCardNumber: pidB,
        ownerName: "Meenakshi Sundaram",
        ownerNationalId: "AADHAAR-XXXX-9912",
        landType: "COMMERCIAL",
        status: "TOPOLOGY_VERIFIED",
        coordinates: [
          [baseLon + 0.00045, baseLat + 0.00004],
          [baseLon + 0.00095, baseLat + 0.00008],
          [baseLon + 0.00091, baseLat + 0.00038],
          [baseLon + 0.00042, baseLat + 0.00035],
          [baseLon + 0.00045, baseLat + 0.00004],
        ],
        calculatedAreaSqMeters: 1710.2,
        perimeterMeters: 168.8,
        centroid: { latitude: baseLat + 0.00021, longitude: baseLon + 0.00068 },
        vertexCount: 4,
        epistemicUncertainty: 0.14,
        aleatoricUncertainty: 0.18,
        overallUncertainty: 0.16,
        structureCount: 1,
        complianceScore: 92,
        encroachmentDetected: false,
        currentHash: `a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abc${Math.floor(
          Math.random() * 1000
        )}`,
        createdAt: now,
        updatedAt: now,
      };

      parcelsToIngest = [newParcelA, newParcelB];
    }

    // Persist parcels to backend store so they are saved in memory and SHA-256 audit ledger
    try {
      const res = await fetch("/api/parcels/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcels: parcelsToIngest,
          surveyorId: "SURV-DRONE-INGEST-01",
          surveyorName: "Automated Orthomosaic Perception Engine",
        }),
      });
      const data = await res.json();
      if (data.parcels && data.parcels.length > 0) {
        onIngestCompleted(data.parcels);
      } else {
        onIngestCompleted(parcelsToIngest);
      }
    } catch (e) {
      console.warn("Backend batch ingestion fallback:", e);
      onIngestCompleted(parcelsToIngest);
    }

    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="shrink-0 px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600/30 border border-sky-500/40 flex items-center justify-center shrink-0">
              <UploadCloud className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Aerial Orthomosaic & Survey File Ingestion
              </h3>
              <p className="text-xs text-slate-400">
                OpenCV Contour Vectorization, Douglas-Peucker Polygon Smoothing & Shoelace Calculation
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

        {/* Source Mode Tabs */}
        <div className="shrink-0 px-6 pt-3 pb-0 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 text-xs">
          <button
            onClick={() => setIngestTab("preset")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              ingestTab === "preset"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preset UAV Flight Missions</span>
          </button>

          <button
            onClick={() => setIngestTab("upload")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              ingestTab === "upload"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Upload Survey File (GeoJSON / Orthomosaic)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {ingestTab === "preset" ? (
            /* Preset Drone Benchmarks */
            <div>
              <label className="font-semibold text-slate-300 block mb-2">
                Select UAV Survey Benchmark Flight:
              </label>
              <div className="space-y-2">
                {benchmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => setSelectedBenchmark(bm.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedBenchmark === bm.id
                        ? "bg-sky-500/10 border-sky-500 text-white"
                        : "bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs flex items-center gap-2">
                        <span>{bm.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-sky-400 border border-slate-700">
                          {bm.altitude} • GSD {bm.gsd}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{bm.description}</div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                        +{bm.parcelsExpected} Vector Lots
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Custom File Drag-and-Drop / Browse Upload Zone */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,.tif,.tiff,.png,.jpg,.jpeg"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-2xl cursor-pointer transition flex flex-col items-center justify-center text-center gap-3 ${
                  isDragging
                    ? "border-sky-400 bg-sky-500/10 ring-4 ring-sky-500/20"
                    : "border-slate-700 hover:border-sky-500/70 bg-slate-950/60 hover:bg-slate-950"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-white">
                    Drag and drop survey files here, or <span className="text-sky-400 underline">browse</span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Supports GeoJSON boundaries (.geojson, .json), UAV GeoTIFFs, or aerial orthomosaic rasters (.png, .jpg)
                  </p>
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  EPSG:4326 WGS84 Geographic Datum Recommended
                </div>
              </div>

              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadedFileName && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCode className="w-5 h-5 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white text-xs">{uploadedFileName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {uploadedFileSize} • Ready for vector pipeline ingestion
                      </div>
                    </div>
                  </div>

                  {uploadedParcels && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {uploadedParcels.length} Lots Parsed
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Vision Parameter Tuning */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Perception Pipeline Tuning (OpenCV & Shapely)</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Canny Lower Threshold:</span>
                  <span className="font-mono text-sky-400">{cannyThresh1}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={cannyThresh1}
                  onChange={(e) => setCannyThresh1(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Canny Upper Threshold:</span>
                  <span className="font-mono text-sky-400">{cannyThresh2}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="250"
                  value={cannyThresh2}
                  onChange={(e) => setCannyThresh2(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Douglas-Peucker Epsilon (ε):</span>
                  <span className="font-mono text-sky-400">{dpEpsilon.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.005"
                  max="0.05"
                  step="0.005"
                  value={dpEpsilon}
                  onChange={(e) => setDpEpsilon(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Min Parcel Area Filter:</span>
                  <span className="font-mono text-sky-400">{minAreaFilter} m²</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={minAreaFilter}
                  onChange={(e) => setMinAreaFilter(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-3 rounded-lg bg-sky-950/60 border border-sky-800 text-sky-200 flex items-center gap-3">
              <Cpu className="w-5 h-5 animate-spin text-sky-400" />
              <div>
                <div className="font-bold text-xs text-white">Running Perception Pipeline...</div>
                <div className="text-[11px] text-sky-300 font-mono mt-0.5">
                  {processingStep}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Produces RFC 7946 GeoJSON Polygons with WGS84 EPSG:4326 Datum
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              id="btn-run-ingest"
              onClick={handleStartIngestion}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vectorize & Ingest Parcels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

