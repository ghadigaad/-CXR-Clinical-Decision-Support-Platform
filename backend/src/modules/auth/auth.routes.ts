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
import { authLimiter } from '../../middleware/rateLimit.js';
import { authenticate, signSession, toPublicDoctor } from './auth.service.js';

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const authRouter = Router();

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const doctor = await authenticate(email, password);

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
