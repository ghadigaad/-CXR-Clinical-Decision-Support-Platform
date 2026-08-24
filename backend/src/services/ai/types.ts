/**
 * Provider-agnostic contract for CXR inference.
 *
 * Everything downstream (routes, report builder, frontend) depends only on these types,
 * so swapping the FastAPI service for a cloud endpoint or a different model means
 * writing one new AiProvider - nothing else changes.
 */

export interface ClassProbability {
  label: string;
  classIndex: number;
  probability: number;
}

/** Distinguishes genuine model output from the development stub. Never inferred. */
export type InferenceSource = 'model' | 'mock';

export interface InferenceResult {
  predictedLabel: string;
  predictedIndex: number;
  confidence: number;
  probabilities: ClassProbability[];
  /** RGBA PNG data URL sized to the uploaded image, or null when unavailable. */
  gradcam: string | null;
  modelVersion: string;
  processingTimeMs: number;
  inputWidth: number;
  inputHeight: number;
  source: InferenceSource;
}

export interface ProviderHealth {
  available: boolean;
  modelLoaded: boolean;
  modelVersion: string | null;
  device: string | null;
  classNames: string[];
  source: InferenceSource;
  error: string | null;
}

/** Non-identifying context passed to the provider. No patient names or record numbers. */
export interface PatientContext {
  age: number;
  gender: string;
  hasClinicalHistory: boolean;
  hasSymptoms: boolean;
}

export interface AnalyzeOptions {
  imageBuffer: Buffer;
  mimeType: string;
  fileName: string;
  patientContext: PatientContext;
  wantGradcam: boolean;
}

export interface AiProvider {
  readonly name: string;
  readonly source: InferenceSource;
  analyze(options: AnalyzeOptions): Promise<InferenceResult>;
  health(): Promise<ProviderHealth>;
}
