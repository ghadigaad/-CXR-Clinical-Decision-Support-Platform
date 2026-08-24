/**
 * Talks to the FastAPI inference service over HTTP.
 *
 * This is the only place that knows the AI service's wire format. If the model moves to
 * a cloud endpoint with a different schema, this file is the single point of change.
 */
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { aiUnavailable, unprocessableImage } from '../../../lib/errors.js';
import type {
  AiProvider,
  AnalyzeOptions,
  InferenceResult,
  ProviderHealth,
} from '../types.js';

interface RawProbability {
  label: string;
  class_index: number;
  probability: number;
}

interface RawPrediction {
  predicted_label: string;
  predicted_index: number;
  confidence: number;
  probabilities: RawProbability[];
  gradcam: string | null;
  model_version: string;
  processing_time_ms: number;
  input_width: number;
  input_height: number;
}

interface RawHealth {
  status: string;
  model_loaded: boolean;
  model_version: string | null;
  device: string;
  class_names: string[];
  error: string | null;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    return JSON.stringify(body.detail ?? {});
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

export class RealAiProvider implements AiProvider {
  readonly name: string;
  readonly source = 'model' as const;
  private readonly resolvedBaseUrl: string;

  constructor(name = 'fastapi-inference-service', baseUrl = env.AI_SERVICE_URL) {
    this.name = name;
    this.resolvedBaseUrl = baseUrl;
  }

  private get baseUrl(): string {
    return this.resolvedBaseUrl.replace(/\/+$/, '');
  }

  async analyze(options: AnalyzeOptions): Promise<InferenceResult> {
    const raw = await this.requestPrediction(options, /* isRetry */ false);

    return {
      predictedLabel: raw.predicted_label,
      predictedIndex: raw.predicted_index,
      confidence: raw.confidence,
      probabilities: raw.probabilities.map((item) => ({
        label: item.label,
        classIndex: item.class_index,
        probability: item.probability,
      })),
      gradcam: raw.gradcam,
      modelVersion: raw.model_version,
      processingTimeMs: raw.processing_time_ms,
      inputWidth: raw.input_width,
      inputHeight: raw.input_height,
      source: this.source,
    };
  }

  private async requestPrediction(
    options: AnalyzeOptions,
    isRetry: boolean,
  ): Promise<RawPrediction> {
    const form = new FormData();
    form.append(
      'image',
      new Blob([new Uint8Array(options.imageBuffer)], { type: options.mimeType }),
      options.fileName,
    );

    const url = `${this.baseUrl}/predict?gradcam=${options.wantGradcam ? 'true' : 'false'}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'X-Internal-Token': env.INTERNAL_API_TOKEN },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const aborted = error instanceof Error && error.name === 'AbortError';
      const message = aborted
        ? `The AI service did not respond within ${env.AI_REQUEST_TIMEOUT_MS / 1000}s.`
        : 'The AI service could not be reached.';

      if (!isRetry && !aborted) {
        logger.warn('AI service request failed, retrying once', { url: this.baseUrl });
        return this.requestPrediction(options, true);
      }
      throw aiUnavailable(message);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      return (await response.json()) as RawPrediction;
    }

    const detail = await readErrorDetail(response);

    // A rejected image is the clinician's problem to fix, not a service outage.
    if (response.status === 422 || response.status === 415) {
      throw unprocessableImage(detail);
    }

    if (RETRYABLE_STATUS.has(response.status) && !isRetry) {
      logger.warn('AI service returned a retryable status', { status: response.status });
      return this.requestPrediction(options, true);
    }

    if (response.status === 503) {
      throw aiUnavailable(
        'The AI model is not loaded on the inference service. Check that the model weights are installed.',
        { detail },
      );
    }

    if (response.status === 401) {
      throw aiUnavailable(
        'The backend is not authorized to call the AI service. INTERNAL_API_TOKEN must match on both sides.',
      );
    }

    throw aiUnavailable(`The AI service returned an error: ${detail}`);
  }

  async health(): Promise<ProviderHealth> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      if (!response.ok) {
        return {
          available: false,
          modelLoaded: false,
          modelVersion: null,
          device: null,
          classNames: [],
          source: this.source,
          error: `AI service responded with HTTP ${response.status}.`,
        };
      }

      const raw = (await response.json()) as RawHealth;
      return {
        available: true,
        modelLoaded: raw.model_loaded,
        modelVersion: raw.model_version,
        device: raw.device,
        classNames: raw.class_names ?? [],
        source: this.source,
        error: raw.error,
      };
    } catch (error) {
      return {
        available: false,
        modelLoaded: false,
        modelVersion: null,
        device: null,
        classNames: [],
        source: this.source,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'The AI service health check timed out.'
            : 'The AI service could not be reached.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
