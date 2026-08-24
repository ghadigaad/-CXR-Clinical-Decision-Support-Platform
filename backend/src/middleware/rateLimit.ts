import rateLimit from 'express-rate-limit';

import { isProduction } from '../config/env.js';

const rateLimitResponse = {
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
};

/** Broad protection for the whole API surface. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 300 : 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitResponse,
});

/** Tight limit on credential submission to blunt password guessing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 10 : 50,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many sign-in attempts. Please wait before trying again.',
    },
  },
});

/** Inference is expensive; cap it separately from cheap CRUD traffic. */
export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProduction ? 12 : 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Analysis rate limit reached. Please wait a moment before submitting again.',
    },
  },
});
