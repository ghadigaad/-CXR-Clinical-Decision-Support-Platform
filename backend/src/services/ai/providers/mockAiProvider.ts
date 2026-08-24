/**
 * DEVELOPMENT STUB - NOT A MODEL.
 *
 * This file exists so the UI can be built and demonstrated before the trained
 * checkpoint is installed. It performs no image analysis whatsoever: the numbers it
 * returns are derived from a hash of the uploaded bytes purely so that the same file
 * yields the same output between reloads.
 *
 * Safeguards, all deliberate:
 *   - Only constructed when AI_PROVIDER=mock (see ../index.ts).
 *   - Refuses to run when NODE_ENV=production (see config/env.ts).
 *   - Every result is tagged source: "mock", which the UI renders as a loud banner.
 *   - The model version string is prefixed "MOCK-NOT-A-REAL-MODEL" so it is obvious in
 *     the database, in reports, and in any exported PDF.
 *
 * Deleting this file and its entry in ../index.ts removes mock support entirely.
 */
import { createHash } from 'node:crypto';

import { logger } from '../../../config/logger.js';
import type {
  AiProvider,
  AnalyzeOptions,
  InferenceResult,
  ProviderHealth,
} from '../types.js';

const CLASS_NAMES = ['Normal', 'Bacterial Pneumonia', 'Viral Pneumonia'];
const MOCK_VERSION = 'MOCK-NOT-A-REAL-MODEL@dev';

/** Deterministic pseudo-probabilities from the file digest - no image content is read. */
function deterministicProbabilities(buffer: Buffer): number[] {
  const digest = createHash('sha256').update(buffer).digest();
  const raw = CLASS_NAMES.map((_, index) => (digest[index * 7] ?? 0) / 255 + 0.05);
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock-development-stub';
  readonly source = 'mock' as const;

  constructor() {
    logger.warn(
      'AI_PROVIDER=mock: analysis results are synthetic placeholders and must not be used clinically.',
    );
  }

  async analyze(options: AnalyzeOptions): Promise<InferenceResult> {
    const started = Date.now();

    // Simulate realistic latency so loading states can be exercised properly.
    await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 700));

    const probabilities = deterministicProbabilities(options.imageBuffer);
    let predictedIndex = 0;
    for (let index = 1; index < probabilities.length; index += 1) {
      if ((probabilities[index] ?? 0) > (probabilities[predictedIndex] ?? 0)) {
        predictedIndex = index;
      }
    }

    return {
      predictedLabel: CLASS_NAMES[predictedIndex] ?? 'Normal',
      predictedIndex,
      confidence: probabilities[predictedIndex] ?? 0,
      probabilities: CLASS_NAMES.map((label, classIndex) => ({
        label,
        classIndex,
        probability: probabilities[classIndex] ?? 0,
      })),
      // No heatmap: fabricating a localization overlay would be actively misleading,
      // and the UI already handles a null overlay by hiding the visualization controls.
      gradcam: null,
      modelVersion: MOCK_VERSION,
      processingTimeMs: Date.now() - started,
      inputWidth: 0,
      inputHeight: 0,
      source: this.source,
    };
  }

  async health(): Promise<ProviderHealth> {
    return {
      available: true,
      modelLoaded: false,
      modelVersion: MOCK_VERSION,
      device: 'none (mock)',
      classNames: CLASS_NAMES,
      source: this.source,
      error: 'Mock provider active: no real model is loaded.',
    };
  }
}
