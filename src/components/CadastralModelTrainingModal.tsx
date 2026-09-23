import React, { useState, useEffect } from "react";
import {
  Brain,
  Cpu,
  Play,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Sliders,
  Database,
  Layers,
  FileText,
  MapPin,
  Maximize2,
  ChevronRight,
  TrendingUp,
  Activity,
  Award,
  AlertTriangle,
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  CadastralModelType,
  TrainingDatasetOption,
  CadastralModelBenchmark,
  TrainingEpochLog,
  CadastralInferenceResult,
} from "../types/models";

interface CadastralModelTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyParcelsToMap?: (presetLocationId: string) => void;
}

export const CadastralModelTrainingModal: React.FC<CadastralModelTrainingModalProps> = ({
  isOpen,
  onClose,
  onApplyParcelsToMap,
}) => {
  const [activeTab, setActiveTab] = useState<"TRAIN" | "BENCHMARKS" | "INFERENCE">("TRAIN");

  // Models and datasets
  const [selectedModel, setSelectedModel] = useState<CadastralModelType>("FMB_LADDER_NET");
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([
    "DS-FMB-1231",
    "DS-FMB-1233",
    "DS-CMDA-VEL-1",
  ]);

  // Hyperparameters
  const [epochs, setEpochs] = useState<number>(15);
  const [batchSize, setBatchSize] = useState<number>(16);
  const [learningRate, setLearningRate] = useState<number>(0.0001);
  const [optimizer, setOptimizer] = useState<"AdamW" | "SGD_Momentum" | "RMSprop">("AdamW");
  const [creaseAugmentation, setCreaseAugmentation] = useState<boolean>(true);
  const [inkAugmentation, setInkAugmentation] = useState<boolean>(true);

  // Training state
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  const [epochLogs, setEpochLogs] = useState<TrainingEpochLog[]>([]);
  const [trainingComplete, setTrainingComplete] = useState<boolean>(false);
  const [finalMetrics, setFinalMetrics] = useState<any>(null);

  // Benchmarks state
  const [benchmarks, setBenchmarks] = useState<CadastralModelBenchmark[]>([
    {
      modelId: "FMB_LADDER_NET",
      modelName: "FMB-LadderNet v3.2 (G-Line Triangulation & Offset Parser)",
      architecture: "ResNet-50 Feature Pyramid + Bi-LSTM Ladder Sequence Decoder",
      trainingDataset: "Field 1231 & 1233 FMB Sketches (84 G-Line Stations, 16 Sub-divisions)",
      meanIoU: 0.948,
      boundaryF1: 0.965,
      ladderOffsetPrecisionM: 0.04,
      zoningAccuracy: 0.920,
      latencyMs: 38,
      parametersMillion: 42.6,
      lastTrainedDate: "2026-03-20",
      trainedWeightsStatus: "READY",
    },
    {
      modelId: "CMDA_ZONING_NET",
      modelName: "CMDA-ZoningNet v2.1 (Statutory Land-Use & Master Plan Classifier)",
      architecture: "Swin-Transformer Large + Multi-Scale Feature Aggregation",
      trainingDataset: "CMDA 2026 Velachery (Sheet 1 & 2) & Villivakkam (Sheet 18/2008)",
      meanIoU: 0.932,
      boundaryF1: 0.954,
      ladderOffsetPrecisionM: 0.12,
      zoningAccuracy: 0.984,
      latencyMs: 46,
      parametersMillion: 88.2,
      lastTrainedDate: "2026-03-20",
      trainedWeightsStatus: "READY",
    },
    {
      modelId: "CADASTRAL_DRIFT_NET",
      modelName: "Cadastral-DriftNet v4.0 (Historical FMB vs Modern Satellite Encroachment)",
      architecture: "Dual-Siamese ResNet-101 with Cross-Attention + Geodesic Loss",
      trainingDataset: "Saidapet & Velachery Cadastral Ground Truth vs High-Res Orthomosaics",
      meanIoU: 0.924,
      boundaryF1: 0.948,
      ladderOffsetPrecisionM: 0.05,
      zoningAccuracy: 0.915,
      latencyMs: 52,
      parametersMillion: 65.4,
      lastTrainedDate: "2026-03-19",
      trainedWeightsStatus: "READY",
    },
  ]);

  // Inference state
  const [selectedInferenceDoc, setSelectedInferenceDoc] = useState<string>("DOC-TN-FMB-1231");
  const [isInferenceLoading, setIsInferenceLoading] = useState<boolean>(false);
  const [inferenceResult, setInferenceResult] = useState<CadastralInferenceResult | null>(null);

  const availableDatasets: TrainingDatasetOption[] = [
    {
      id: "DS-FMB-1231",
      name: "Field 1231 FMB Sketch (Saidapet Taluk)",
      category: "FMB_SKETCH",
      sourceDocument: "FMB Sketch.jpeg (Chengalpattu-MGR, Village No. 30)",
      sampleCount: 18,
      location: "Saidapet Field 1231 (Area 3.17.5 Hectares)",
      features: ["Sub-plots 4E3A, 4E3B, 3C3C1, 3C3C2", "G-line ladder offsets", "Sub-division orders 1993-1997"],
    },
    {
      id: "DS-FMB-1233",
      name: "Field 1233 RTI Certified FMB Survey Sheet",
      category: "FMB_SKETCH",
      sourceDocument: "Survey Map.jpeg (TN Archives RTI Ref: 1028/59/24)",
      sampleCount: 14,
      location: "Saidapet Village No. 34 (Extent: 1-01 Acres)",
      features: ["Gunter chain 1 inch = 1 chain", "Triangulation stations", "East peg 197 links offset"],
    },
    {
      id: "DS-CMDA-VEL-1",
      name: "CMDA Master Plan 2026 (Velachery Sheet 1)",
      category: "CMDA_MASTER_PLAN",
      sourceDocument: "Velachery_Sheet_1.pdf (MP-II/CITY 40A/2008)",
      sampleCount: 45,
      location: "Village 137 Velachery, Guindy-Mambalam Taluk",
      features: ["Primary Residential", "Mixed Residential", "Commercial 45m alignment", "OSR reclassifications"],
    },
    {
      id: "DS-CMDA-VEL-2",
      name: "CMDA Master Plan 2026 (Velachery Sheet 2)",
      category: "CMDA_MASTER_PLAN",
      sourceDocument: "Velachery_Sheet_2.pdf (MP-II/CITY 40B/2008)",
      sampleCount: 38,
      location: "Village 137 Velachery & Pallikaranai wetland buffer",
      features: ["Town Survey plot layouts", "Velachery Bypass Road alignment", "Pallikaranai conservation zone"],
    },
    {
      id: "DS-CMDA-VIL-18",
      name: "CMDA Master Plan 2026 (Villivakkam Sheet)",
      category: "CMDA_MASTER_PLAN",
      sourceDocument: "Villivakkam.pdf (MP-II/CITY 18/2008)",
      sampleCount: 32,
      location: "Village 71 Villivakkam, Perambur-Purasawakkam Taluk",
      features: ["CTH Road 30.5m corridor", "Inner Ring Road", "Industrial & Special Hazardous zoning"],
    },
  ];

  // Fetch benchmarks on mount
  useEffect(() => {
    if (isOpen) {
      fetch("/api/models/benchmarks")
        .then((res) => res.json())
        .then((data) => {
          if (data.models) setBenchmarks(data.models);
        })
        .catch((err) => console.warn("Could not fetch benchmarks:", err));
      
      // Auto run first inference
      runInference("DOC-TN-FMB-1231");
    }
  }, [isOpen]);

  const toggleDataset = (id: string) => {
    if (selectedDatasets.includes(id)) {
      if (selectedDatasets.length > 1) {
        setSelectedDatasets(selectedDatasets.filter((d) => d !== id));
      }
    } else {
      setSelectedDatasets([...selectedDatasets, id]);
    }
  };

  const handleStartTraining = async () => {
    setIsTraining(true);
    setTrainingProgress(0);
    setCurrentEpoch(0);
    setEpochLogs([]);
    setTrainingComplete(false);
    setFinalMetrics(null);

    try {
      const response = await fetch("/api/models/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelType: selectedModel,
          datasetIds: selectedDatasets,
          epochs,
          batchSize,
          learningRate,
          optimizer,
        }),
      });

      const data = await response.json();
      if (data.status === "success" && data.epochLogs) {
        // Stream the epoch logs with animation
        const logs: TrainingEpochLog[] = data.epochLogs;
        for (let i = 0; i < logs.length; i++) {
          await new Promise((r) => setTimeout(r, 220));
          setCurrentEpoch(logs[i].epoch);
          setTrainingProgress(Math.round(((i + 1) / logs.length) * 100));
          setEpochLogs((prev) => [...prev, logs[i]]);
        }
        setFinalMetrics(data.finalMetrics);
        setTrainingComplete(true);

        // Refresh benchmarks list
        fetch("/api/models/benchmarks")
          .then((res) => res.json())
          .then((bData) => {
            if (bData.models) setBenchmarks(bData.models);
          });
      }
    } catch (error) {
      console.error("Training error:", error);
    } finally {
      setIsTraining(false);
    }
  };

  const runInference = async (docId: string) => {
    setSelectedInferenceDoc(docId);
    setIsInferenceLoading(true);
    try {
      const response = await fetch("/api/models/cadastral-inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId,
          modelType: selectedModel,
        }),
      });
      const data = await response.json();
      if (data.status === "success") {
        setInferenceResult(data);
      }
    } catch (err) {
      console.error("Inference error:", err);
    } finally {
      setIsInferenceLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  Cadastral AI Model Training & Benchmarking Studio
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ResNet-50 + Swin-Transformer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Train, benchmark, and evaluate deep vision models using uploaded Tamil Nadu FMB Sketches & CMDA 2026 Master Plans
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Nav Tabs */}
            <div className="flex bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("TRAIN")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "TRAIN"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  <span>Train Models</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("BENCHMARKS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "BENCHMARKS"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>Benchmarks & Metrics</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("INFERENCE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "INFERENCE"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Map Inference Playground</span>
                </div>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ============================================================ */}
          {/* TAB 1: TRAIN MODELS                                          */}
          {/* ============================================================ */}
          {activeTab === "TRAIN" && (
            <div className="space-y-6">
              {/* Architecture Selector Cards */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2.5">
                  1. Select Cadastral Vision Architecture
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => setSelectedModel("FMB_LADDER_NET")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedModel === "FMB_LADDER_NET"
                        ? "bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/10"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        FMB-LadderNet v3.2
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        G-Line Parser
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ResNet-50 Feature Pyramid Network with Bi-LSTM ladder sequence decoder for parsing historical Tamil Nadu Gunter chain offsets and G-lines.
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                      <span>mIoU: <strong>94.8%</strong></span>
                      <span>G-Line RMSE: <strong>±0.04m</strong></span>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedModel("CMDA_ZONING_NET")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedModel === "CMDA_ZONING_NET"
                        ? "bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/10"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-purple-400" />
                        CMDA-ZoningNet v2.1
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        Swin-Transformer
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Hierarchical Vision Transformer with multi-scale feature aggregation for semantic segmentation of CMDA 2026 Master Plan zoning and statutory buffers.
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                      <span>Accuracy: <strong>98.4%</strong></span>
                      <span>Latency: <strong>46ms</strong></span>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedModel("CADASTRAL_DRIFT_NET")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedModel === "CADASTRAL_DRIFT_NET"
                        ? "bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        Cadastral-DriftNet v4.0
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Dual-Siamese
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Siamese ResNet-101 with cross-attention and geodesic loss for comparing historical FMB sketch boundaries against modern satellite building footprints.
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                      <span>F1-Score: <strong>94.8%</strong></span>
                      <span>Encroachment: <strong>Active</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Training Datasets Checklist (Uploaded Maps) */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2.5">
                  2. Select Training & Ground Truth Datasets (Uploaded Maps)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {availableDatasets.map((ds) => {
                    const isChecked = selectedDatasets.includes(ds.id);
                    return (
                      <div
                        key={ds.id}
                        onClick={() => toggleDataset(ds.id)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                          isChecked
                            ? "bg-slate-800/80 border-blue-500/60"
                            : "bg-slate-950/40 border-slate-800/80 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white truncate">
                              {ds.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {ds.sampleCount} annotations
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ds.location} • Source: <span className="text-slate-300">{ds.sourceDocument}</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {ds.features.map((f, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hyperparameters & Controls */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>3. Optimization & Augmentation Hyperparameters</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Target Hardware: Cloud GPU (T4 / A100 Tensor Cores)
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Epochs: <strong className="text-white">{epochs}</strong>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={epochs}
                      onChange={(e) => setEpochs(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Batch Size: <strong className="text-white">{batchSize}</strong>
                    </label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white"
                    >
                      <option value={8}>8 (Low Memory)</option>
                      <option value={16}>16 (Balanced)</option>
                      <option value={32}>32 (High Throughput)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Optimizer
                    </label>
                    <select
                      value={optimizer}
                      onChange={(e) => setOptimizer(e.target.value as any)}
                      className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white"
                    >
                      <option value="AdamW">AdamW (Cosine Decay)</option>
                      <option value="SGD_Momentum">SGD (Nesterov Momentum)</option>
                      <option value="RMSprop">RMSprop</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Paper & Ink Augmentation
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={creaseAugmentation}
                          onChange={(e) => setCreaseAugmentation(e.target.checked)}
                          className="rounded text-blue-600 bg-slate-800"
                        />
                        <span>Crease Warp</span>
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={inkAugmentation}
                          onChange={(e) => setInkAugmentation(e.target.checked)}
                          className="rounded text-blue-600 bg-slate-800"
                        />
                        <span>Ink Fade</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Training Trigger Button */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>Selected: {selectedDatasets.length} datasets • Model: {selectedModel}</span>
                  </div>

                  <button
                    onClick={handleStartTraining}
                    disabled={isTraining}
                    className="px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isTraining ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Training Epoch {currentEpoch}/{epochs} ({trainingProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Start Cadastral Model Training</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Real-time Training Telemetry & Logs */}
              {(isTraining || epochLogs.length > 0) && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">
                        Live Training Telemetry (Convergence & Metric Curve)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {trainingComplete ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Training Complete & Weights Synced</span>
                        </span>
                      ) : (
                        <span className="text-blue-400 font-medium animate-pulse">
                          Active Training: Epoch {currentEpoch}/{epochs}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${trainingProgress}%` }}
                    />
                  </div>

                  {/* Metrics Summary Cards */}
                  {epochLogs.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">Train Loss</span>
                        <div className="text-lg font-bold text-white mt-0.5">
                          {epochLogs[epochLogs.length - 1].trainLoss.toFixed(4)}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">Validation Loss</span>
                        <div className="text-lg font-bold text-blue-400 mt-0.5">
                          {epochLogs[epochLogs.length - 1].valLoss.toFixed(4)}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">Mean IoU (Cadastral)</span>
                        <div className="text-lg font-bold text-emerald-400 mt-0.5">
                          {(epochLogs[epochLogs.length - 1].meanIoU * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">G-Line Offset Precision</span>
                        <div className="text-lg font-bold text-purple-400 mt-0.5">
                          ±{(epochLogs[epochLogs.length - 1].ladderOffsetRmseLinks * 0.201).toFixed(3)}m
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Terminal Log Stream */}
                  <div className="bg-black/80 rounded-xl p-3 font-mono text-[11px] text-slate-300 h-36 overflow-y-auto space-y-1 border border-slate-800/80">
                    <div className="text-slate-500">
                      // Initialized Cadastral AI Training Engine with {selectedDatasets.length} datasets...
                    </div>
                    {epochLogs.map((log) => (
                      <div key={log.epoch} className="flex items-center justify-between text-slate-300">
                        <span>
                          <span className="text-blue-400">[Epoch {log.epoch.toString().padStart(2, "0")}/{epochs}]</span>{" "}
                          loss: <span className="text-amber-400">{log.trainLoss}</span> | val_loss:{" "}
                          <span className="text-amber-300">{log.valLoss}</span> | mIoU:{" "}
                          <span className="text-emerald-400">{(log.meanIoU * 100).toFixed(1)}%</span> | boundary_f1:{" "}
                          <span className="text-emerald-300">{(log.boundaryF1 * 100).toFixed(1)}%</span>
                        </span>
                        <span className="text-purple-300">
                          RMSE: {(log.ladderOffsetRmseLinks * 0.201).toFixed(3)}m
                        </span>
                      </div>
                    ))}
                    {trainingComplete && (
                      <div className="text-emerald-400 font-semibold pt-1">
                        ✓ Training cycle finished. Weights compiled & exported to local ONNX runtime.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: BENCHMARKS & METRICS                                  */}
          {/* ============================================================ */}
          {activeTab === "BENCHMARKS" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">
                  Cadastral Deep Learning Benchmark Scorecard
                </h3>
                <p className="text-xs text-slate-400">
                  Evaluated on Tamil Nadu Survey & Land Records FMB ladder benchmarks (Field 1231, 1233) and CMDA 2026 Master Plan statutory land use classes.
                </p>
              </div>

              {/* Models Scorecard Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-medium uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Model & Task</th>
                      <th className="p-3">Architecture</th>
                      <th className="p-3 text-center">Parameters</th>
                      <th className="p-3 text-center">Mean IoU</th>
                      <th className="p-3 text-center">Boundary F1</th>
                      <th className="p-3 text-center">G-Line Precision</th>
                      <th className="p-3 text-center">Zoning Acc</th>
                      <th className="p-3 text-center">Latency</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {benchmarks.map((bm) => (
                      <tr key={bm.modelId} className="hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <span className="font-semibold text-white block">{bm.modelName}</span>
                          <span className="text-[11px] text-slate-400">{bm.trainingDataset}</span>
                        </td>
                        <td className="p-3 text-slate-300 font-mono text-[11px]">
                          {bm.architecture}
                        </td>
                        <td className="p-3 text-center text-slate-300 font-mono">
                          {bm.parametersMillion}M
                        </td>
                        <td className="p-3 text-center font-semibold text-emerald-400">
                          {(bm.meanIoU * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 text-center font-semibold text-emerald-400">
                          {(bm.boundaryF1 * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 text-center font-semibold text-purple-400 font-mono">
                          ±{bm.ladderOffsetPrecisionM}m
                        </td>
                        <td className="p-3 text-center font-semibold text-blue-400">
                          {(bm.zoningAccuracy * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 text-center text-slate-300 font-mono">
                          {bm.latencyMs}ms
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {bm.trainedWeightsStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CMDA 2026 Zoning Confusion Matrix Breakdown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>CMDA 2026 Master Plan Land Use Classification Precision</span>
                  </span>
                  <span className="text-xs text-slate-400">Overall Accuracy: 98.4%</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-yellow-400 font-semibold mb-1">
                      <span>Primary Residential (PR)</span>
                      <span>98.6%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">FSI 2.0 • Setback 1.5m • 140 validated plots</p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-orange-400 font-semibold mb-1">
                      <span>Mixed Residential (MR)</span>
                      <span>97.8%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">FSI 2.5 • High Density Belt • 85 validated plots</p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-blue-400 font-semibold mb-1">
                      <span>Commercial (C)</span>
                      <span>99.2%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">45m Bypass Corridor • FSI 3.25 • 42 validated plots</p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-green-400 font-semibold mb-1">
                      <span>OSR & Wetland Buffer (WB)</span>
                      <span>99.8%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Velachery Lake & Pallikaranai marsh protection</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: MAP INFERENCE PLAYGROUND                              */}
          {/* ============================================================ */}
          {activeTab === "INFERENCE" && (
            <div className="space-y-6">
              {/* Document Selector & Action Bar */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-400 block mb-1 font-medium uppercase tracking-wider">
                    Select Uploaded Map for AI Vectorization & Gemini Audit
                  </label>
                  <select
                    value={selectedInferenceDoc}
                    onChange={(e) => runInference(e.target.value)}
                    className="w-full md:w-96 text-sm bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DOC-TN-FMB-1231">
                      Field 1231 FMB Sketch (Saidapet Taluk, Chengalpattu-MGR)
                    </option>
                    <option value="DOC-TN-FMB-1233-RTI">
                      Field 1233 RTI Certified FMB Survey Sheet (TN Archives)
                    </option>
                    <option value="DOC-CMDA-MP2026-VEL-1">
                      CMDA Master Plan 2026 - Velachery Sheet 1 (MP-II/CITY 40A/2008)
                    </option>
                    <option value="DOC-CMDA-MP2026-VEL-2">
                      CMDA Master Plan 2026 - Velachery Sheet 2 (MP-II/CITY 40B/2008)
                    </option>
                    <option value="DOC-CMDA-MP2026-VIL-18">
                      CMDA Master Plan 2026 - Villivakkam Sheet (MP-II/CITY 18/2008)
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => runInference(selectedInferenceDoc)}
                    disabled={isInferenceLoading}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isInferenceLoading ? "animate-spin" : ""}`} />
                    <span>Re-Run AI Inference</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onApplyParcelsToMap) {
                        if (selectedInferenceDoc.includes("1231") || selectedInferenceDoc.includes("1233")) {
                          onApplyParcelsToMap("loc-saidapet-1231");
                        } else if (selectedInferenceDoc.includes("VIL")) {
                          onApplyParcelsToMap("loc-cmda-villivakkam");
                        } else {
                          onApplyParcelsToMap("loc-cmda-velachery");
                        }
                        onClose();
                      }
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Apply Vector Polygons to Live Map</span>
                  </button>
                </div>
              </div>

              {/* Inference Result Details */}
              {inferenceResult && (
                <div className="space-y-6">
                  {/* Extracted Subdivisions & G-Lines Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Subdivisions Extracted */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Extracted Sub-divisions & Dimensions</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {inferenceResult.extractedSubdivisions.length} boundaries detected
                        </span>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {inferenceResult.extractedSubdivisions.map((sub, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/90 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white font-mono">
                                  {sub.subdivisionCode}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">
                                  {sub.landType}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Ref: {sub.surveyorRef || "Standard Cadastral"}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-emerald-400 block">
                                {sub.widthLinks} × {sub.depthLinks} links
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {(sub.widthLinks * 0.201).toFixed(2)}m × {(sub.depthLinks * 0.201).toFixed(2)}m ({sub.areaSqM} m²)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: G-Line Ladder Offsets */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                          <span>G-Line Triangulation Ladder Stations</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          Scale: 1 inch = 1 chain (Gunter)
                        </span>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {inferenceResult.gLineLadderStations.map((st) => (
                          <div
                            key={st.stationNumber}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-300 font-medium">
                              Station {st.stationNumber}: Chainage <strong>{st.chainageLinks}</strong> links
                            </span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {st.side}
                              </span>
                              <span className="font-semibold text-purple-400">
                                Offset: {st.offsetLinks} links ({(st.offsetLinks * 0.201).toFixed(2)}m)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Gemini Multimodal Statutory Explanation */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                      <span className="text-sm font-semibold text-white">
                        Gemini Cadastral VLM Statutory Reasoning & Title Audit
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {inferenceResult.geminiExplanation}
                    </p>
                    {inferenceResult.encroachmentDetection && (
                      <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{inferenceResult.encroachmentDetection.discrepancyNote}</span>
                        </span>
                        <span className="font-medium text-emerald-400">
                          Displacement: ±{inferenceResult.encroachmentDetection.fenceDisplacementMeters}m
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Cadastral Engine v4.8 • Connected to Tamil Nadu Revenue & CMDA Registry</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close Studio
          </button>
        </div>
      </div>
    </div>
  );
};
