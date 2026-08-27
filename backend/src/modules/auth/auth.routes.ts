import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import { unauthorized } from '../../lib/errors.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  SESSION_COOKIE,
  currentDoctor,
  requireAuth,
  sessionCookieOptions,
} from '../../middleware/auth.js';
import { authLimiter, otpLimiter } from '../../middleware/rateLimit.js';
import {
  completeSessionFromAccessToken,
  completeSessionFromTokenHash,
  requestEmailOtp,
  signSession,
  toPublicDoctor,
  verifyEmailOtp,
} from './auth.service.js';

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

const verifySchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  token: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, 'Enter the code from your email.'),
});

const linkSchema = z
  .object({
    accessToken: z.string().min(20).optional(),
    tokenHash: z.string().min(8).optional(),
    type: z.enum(['email', 'magiclink']).optional(),
  })
  .refine((value) => Boolean(value.accessToken || value.tokenHash), {
    message: 'Sign-in token is missing.',
  });

export const authRouter = Router();

authRouter.post(
  '/request-otp',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { email } = emailSchema.parse(req.body);
    const normalized = email.toLowerCase().trim();
    await requestEmailOtp(normalized);

    await recordAudit({
      action: 'auth.request_otp',
      entityType: 'Doctor',
      req,
    });

    res.json({ sent: true });
  }),
);

authRouter.post(
  '/verify-otp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, token } = verifySchema.parse(req.body);
    const doctor = await verifyEmailOtp(email.toLowerCase().trim(), token.trim());

    res.cookie(SESSION_COOKIE, signSession(doctor), sessionCookieOptions(SESSION_MAX_AGE_MS));

    await recordAudit({
      doctorId: doctor.id,
      action: 'auth.login',
      entityType: 'Doctor',
      entityId: doctor.id,
      req,
    });

    res.json({ doctor: toPublicDoctor(doctor) });
  }),
);

authRouter.post(
  '/session',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = linkSchema.parse(req.body);
    const doctor = body.accessToken
      ? await completeSessionFromAccessToken(body.accessToken)
      : await completeSessionFromTokenHash(body.tokenHash as string, body.type ?? 'email');

    res.cookie(SESSION_COOKIE, signSession(doctor), sessionCookieOptions(SESSION_MAX_AGE_MS));

    await recordAudit({
      doctorId: doctor.id,
      action: 'auth.login',
      entityType: 'Doctor',
      entityId: doctor.id,
      req,
    });

    res.json({ doctor: toPublicDoctor(doctor) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(0), maxAge: undefined });

    if (typeof token === 'string' && token.length > 0) {
      await recordAudit({ action: 'auth.logout', entityType: 'Doctor', req });
    }

    res.json({ success: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = currentDoctor(req);
    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) throw unauthorized();
    res.json({ doctor: toPublicDoctor(doctor) });
  }),
);
