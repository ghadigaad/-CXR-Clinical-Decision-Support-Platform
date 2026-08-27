import { Router } from 'express';

import { env } from '../../config/env.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { DEFAULT_MODEL_ID, MODEL_CATALOG } from '../../services/ai/catalog.js';
import { getAiHealth, listModels } from '../../services/aiService.js';
import { AI_DISCLAIMER, RISK_THRESHOLDS } from '../../services/reportBuilder.js';

export const systemRouter = Router();

/** Public: liveness, plus unauthenticated OTP request/verify on /api/auth. */
systemRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

systemRouter.get(
  '/model-info',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [health, models] = await Promise.all([getAiHealth(), listModels()]);
    const defaultDefinition = MODEL_CATALOG[DEFAULT_MODEL_ID];

    res.json({
      ai: health,
      models: models.map((model) => ({
        id: model.id,
        name: model.name,
        shortName: model.shortName,
        description: model.description,
        isDefault: model.isDefault,
        available: model.health.available,
        modelLoaded: model.health.modelLoaded,
        modelVersion: model.health.modelVersion,
        device: model.health.device,
        error: model.health.error,
        evaluation: model.evaluation,
      })),
      evaluation: defaultDefinition.evaluation,
      disclaimer: AI_DISCLAIMER,
      riskThresholds: RISK_THRESHOLDS,
      retention: {
        storeOriginalImages: env.STORE_ORIGINAL_IMAGES,
        storeThumbnails: env.STORE_THUMBNAILS,
        thumbnailSize: env.THUMBNAIL_SIZE,
        maxUploadBytes: env.MAX_UPLOAD_BYTES,
      },
      gradcamEnabled: env.AI_ENABLE_GRADCAM,
    });
  }),
);
