/**
 * Cadastral AI Model Training & Inference Type Definitions
 * Designed for training on Tamil Nadu FMB sketches, RTI Archives, and CMDA 2026 Master Plans
 */

export type CadastralModelType = 
  | "FMB_LADDER_NET"
  | "CMDA_ZONING_NET"
  | "CADASTRAL_DRIFT_NET";

export interface TrainingDatasetOption {
  id: string;
  name: string;
  category: "FMB_SKETCH" | "CMDA_MASTER_PLAN" | "SATELLITE_CADASTRAL";
  sourceDocument: string;
  sampleCount: number;
  location: string;
  features: string[];
}

export interface ModelHyperparameters {
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: "AdamW" | "SGD_Momentum" | "RMSprop";
  lossFunction: "Dice_Focal_Loss" | "Geodesic_RMSE" | "MultiTask_CrossEntropy";
  dataAugmentation: {
    paperCreaseSimulation: boolean;
    affineRotationJitter: boolean;
    inkDegradationFilter: boolean;
    perspectiveWarp: boolean;
  };
}

export interface TrainingEpochLog {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  meanIoU: number;
  boundaryF1: number;
  ladderOffsetRmseLinks: number;
  learningRate: number;
  timestamp: number;
}

export interface CadastralModelBenchmark {
  modelId: CadastralModelType;
  modelName: string;
  architecture: string;
  trainingDataset: string;
  meanIoU: number;
  boundaryF1: number;
  ladderOffsetPrecisionM: number;
  zoningAccuracy: number;
  latencyMs: number;
  parametersMillion: number;
  lastTrainedDate: string;
  trainedWeightsStatus: "READY" | "TRAINING" | "IDLE";
}

export interface CadastralInferenceResult {
  documentId: string;
  documentTitle: string;
  modelUsed: string;
  confidenceScore: number;
  processingTimeMs: number;
  extractedSubdivisions: {
    subdivisionCode: string;
    widthLinks: number;
    depthLinks: number;
    areaSqM: number;
    landType: string;
    plottedDate?: string;
    surveyorRef?: string;
  }[];
  gLineLadderStations: {
    stationNumber: number;
    chainageLinks: number;
    offsetLinks: number;
    side: "LEFT" | "RIGHT" | "CENTRAL";
  }[];
  cmdaZoningAnalysis?: {
    primaryZone: string;
    statutoryCode: string;
    permissibleFsi: number;
    setbackMandates: { frontM: number; rearM: number; sideM: number };
    isReclassified: boolean;
    reclassificationNote?: string;
  };
  encroachmentDetection?: {
    fenceDisplacementMeters: number;
    encroachmentSeverity: "NONE" | "LOW" | "MODERATE" | "CRITICAL";
    discrepancyNote: string;
  };
  geminiExplanation?: string;
}
