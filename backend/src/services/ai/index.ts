/**
 * Provider selection. This is the single switch between real inference and the
 * development stub - there is no runtime fallback in either direction, so a broken AI
 * service surfaces as an error rather than silently degrading to synthetic output.
 *
 * Each selectable model is its own inference process. Choosing EfficientNet never
 * silently falls back to DenseNet, and vice versa.
 */
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { badRequest } from '../../lib/errors.js';
import {
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
  MODEL_IDS,
  type ModelId,
  isModelId,
} from './catalog.js';
import { MockAiProvider } from './providers/mockAiProvider.js';
import { RealAiProvider } from './providers/realAiProvider.js';
import type { AiProvider, ProviderHealth } from './types.js';

export type { ModelId } from './catalog.js';
export {
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
  MODEL_IDS,
  isModelId,
  modelNameFromVersion,
} from './catalog.js';

let providers: Record<ModelId, AiProvider> | null = null;

function urlFor(modelId: ModelId): string {
  return modelId === 'efficientnetv2' ? env.AI_EFFICIENTNET_URL : env.AI_SERVICE_URL;
}

function createProviders(): Record<ModelId, AiProvider> {
  if (env.AI_PROVIDER === 'mock') {
    const mock = new MockAiProvider();
    return {
      'densenet-cbam': mock,
      efficientnetv2: mock,
    };
  }

  return {
    'densenet-cbam': new RealAiProvider('densenet-cbam', env.AI_SERVICE_URL),
    efficientnetv2: new RealAiProvider('efficientnetv2', env.AI_EFFICIENTNET_URL),
  };
}

function getProviders(): Record<ModelId, AiProvider> {
  if (!providers) {
    providers = createProviders();
    logger.info('AI providers initialized', {
      source: env.AI_PROVIDER === 'mock' ? 'mock' : 'model',
      models: MODEL_IDS.map((id) => ({ id, url: urlFor(id) })),
    });
  }
  return providers;
}

export function parseModelId(value: string | undefined): ModelId {
  if (!value) return DEFAULT_MODEL_ID;
  if (!isModelId(value)) {
    throw badRequest(`Unknown model "${value}". Choose densenet-cbam or efficientnetv2.`);
  }
  return value;
}

export function getAiProvider(modelId: ModelId = DEFAULT_MODEL_ID): AiProvider {
  return getProviders()[modelId];
}

export interface ListedModel {
  id: ModelId;
  name: string;
  shortName: string;
  description: string;
  isDefault: boolean;
  evaluation: (typeof MODEL_CATALOG)[ModelId]['evaluation'];
  health: ProviderHealth;
}

export async function listModels(): Promise<ListedModel[]> {
  const registry = getProviders();
  return Promise.all(
    MODEL_IDS.map(async (id) => {
      const definition = MODEL_CATALOG[id];
      const health = await registry[id].health();
      return { ...definition, health };
    }),
  );
}

export * from './types.js';
