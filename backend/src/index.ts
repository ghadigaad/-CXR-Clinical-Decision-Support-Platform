import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { listModels } from './services/aiService.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('API server listening', {
    port: env.PORT,
    env: env.NODE_ENV,
    aiProvider: env.AI_PROVIDER,
  });

  // Report AI reachability at boot so a misconfigured token or a missing checkpoint is
  // visible immediately rather than on the first clinical request.
  void listModels().then((models) => {
    for (const model of models) {
      if (model.health.available && model.health.modelLoaded) {
        logger.info('AI model ready', {
          modelId: model.id,
          modelVersion: model.health.modelVersion,
          device: model.health.device,
        });
      } else {
        logger.warn('AI model not ready', {
          modelId: model.id,
          error: model.health.error,
        });
      }
    }
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutting down', { signal });
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  // Do not let an in-flight inference request hold the process open indefinitely.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  });
});
