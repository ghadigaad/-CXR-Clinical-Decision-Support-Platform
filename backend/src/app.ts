import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { analysesRouter, analyzeRouter } from './modules/analyses/analyses.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { patientsRouter } from './modules/patients/patients.routes.js';
import { systemRouter } from './modules/system/system.routes.js';

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy in production, req.ip must reflect the real client for rate
  // limiting and audit logs to be meaningful.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only; CSP is enforced by the frontend's own host.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()),
      // Required for the session cookie to travel with XHR.
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/patients', patientsRouter);
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/analyses', analysesRouter);
  app.use('/api/system', systemRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
