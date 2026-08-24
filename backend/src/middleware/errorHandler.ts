import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(error.message, { code: error.code, path: req.path });
    }
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data is invalid.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const isTooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      error: {
        code: isTooLarge ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
        message: isTooLarge ? 'The uploaded file is too large.' : error.message,
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ');
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: target
            ? `A record with the same ${target} already exists.`
            : 'A record with these details already exists.',
        },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
      return;
    }
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Unhandled error', {
    path: req.path,
    method: req.method,
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      // Internal messages can leak schema or filesystem details, so production gets a
      // generic string while development keeps the real one for debugging.
      message: isProduction ? 'An unexpected error occurred.' : message,
    },
  });
}
