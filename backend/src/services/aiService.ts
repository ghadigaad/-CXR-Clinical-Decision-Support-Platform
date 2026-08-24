/**
 * Public entry point for CXR inference.
 *
 * Route handlers call analyzeCXR() and never touch a provider directly, so the model
 * can move between a local Python process, a FastAPI server, or a cloud endpoint
 * without any change outside src/services/ai/.
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  DEFAULT_MODEL_ID,
  getAiProvider,
  listModels,
  type ModelId,
} from './ai/index.js';
import type { InferenceResult, PatientContext, ProviderHealth } from './ai/types.js';

export type { InferenceResult, PatientContext, ProviderHealth } from './ai/types.js';
export { listModels, parseModelId, type ModelId } from './ai/index.js';

export interface AnalyzeInput {
  imageBuffer: Buffer;
  mimeType: string;
  fileName: string;
  patientContext: PatientContext;
  modelId?: ModelId;
}

/**
 * Run inference on a preprocessed chest X-ray.
 *
 * The buffer must already be validated and EXIF-stripped by the upload pipeline; this
 * function is about model access, not file safety.
 */
export async function analyzeCXR(input: AnalyzeInput): Promise<InferenceResult> {
  const modelId = input.modelId ?? DEFAULT_MODEL_ID;
  const provider = getAiProvider(modelId);
  const started = Date.now();

  const result = await provider.analyze({
    imageBuffer: input.imageBuffer,
    mimeType: input.mimeType,
    fileName: input.fileName,
    patientContext: input.patientContext,
    wantGradcam: env.AI_ENABLE_GRADCAM,
  });

  logger.info('Inference completed', {
    modelId,
    provider: provider.name,
    source: result.source,
    modelVersion: result.modelVersion,
    // The predicted label is model metadata, not patient data, so it is safe to log.
    predictedLabel: result.predictedLabel,
    roundTripMs: Date.now() - started,
  });

  return result;
}

export function getAiHealth(): Promise<ProviderHealth> {
  return getAiProvider().health();
}
