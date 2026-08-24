/** Shared response types, mirroring the backend serializers. */

export type Role = 'DOCTOR' | 'ADMIN';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type AnalysisStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'FINALIZED';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';
/** "mock" marks output from the development stub rather than the trained model. */
export type InferenceSource = 'model' | 'mock';

export interface Doctor {
  id: string;
  email: string;
  fullName: string;
  specialty: string | null;
  licenseId: string | null;
  role: Role;
  lastLoginAt: string | null;
}

export interface Patient {
  id: string;
  medicalRecordNumber: string;
  fullName: string;
  age: number;
  gender: Gender;
  dateOfBirth: string | null;
  clinicalHistory: string | null;
  symptoms: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListItem extends Patient {
  analysisCount: number;
  latestAnalysis: {
    createdAt: string;
    label: string;
    confidence: number;
    riskLevel: RiskLevel;
  } | null;
}

export interface ClassProbability {
  label: string;
  classIndex: number;
  probability: number;
}

export interface Prediction {
  label: string;
  classIndex: number;
  confidence: number;
  probabilities: ClassProbability[];
}

export interface AnalysisImage {
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  /** Small preview for lists. */
  thumbnail: string | null;
  /** Larger rendition for the viewer and report; omitted from list responses. */
  display: string | null;
  heatmap: string | null;
  retained: boolean;
}

export interface Report {
  id: string;
  impression: string;
  observations: string[];
  recommendations: string[];
  finalizedAt: string | null;
  finalizedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  comments: string | null;
  additionalFindings: string | null;
  finalAssessment: string | null;
  agreesWithAi: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface Analysis {
  id: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  prediction: Prediction;
  riskLevel: RiskLevel;
  modelName?: string;
  modelVersion: string;
  processingTimeMs: number;
  source: InferenceSource;
  image: AnalysisImage;
  patient: Patient | null;
  report: Report | null;
  review: Review | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  patientCount: number;
  totalAnalyses: number;
  analysesThisWeek: number;
  pendingReview: number;
  finalized: number;
  predictionBreakdown: { label: string; count: number }[];
}

export interface ModelStatus {
  id: 'densenet-cbam' | 'efficientnetv2';
  name: string;
  shortName: string;
  description: string;
  isDefault: boolean;
  available: boolean;
  modelLoaded: boolean;
  modelVersion: string | null;
  device: string | null;
  error: string | null;
  evaluation: {
    dataset: string;
    sampleCount: number | null;
    accuracy: number | null;
    perClass: {
      label: string;
      precision: number;
      recall: number;
      f1: number;
      auc: number;
      support: number;
    }[];
    caveat: string;
  };
}

export interface ModelInfo {
  ai: {
    available: boolean;
    modelLoaded: boolean;
    modelVersion: string | null;
    device: string | null;
    classNames: string[];
    source: InferenceSource;
    error: string | null;
  };
  models: ModelStatus[];
  evaluation: {
    dataset: string;
    sampleCount: number | null;
    accuracy: number | null;
    perClass: {
      label: string;
      precision: number;
      recall: number;
      f1: number;
      auc: number;
      support: number;
    }[];
    caveat: string;
  };
  disclaimer: string;
  riskThresholds: { highConfidence: number; lowConfidence: number };
  retention: {
    storeOriginalImages: boolean;
    storeThumbnails: boolean;
    thumbnailSize: number;
    maxUploadBytes: number;
  };
  gradcamEnabled: boolean;
}
