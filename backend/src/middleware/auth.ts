import type { Role } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { env, isProduction } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifySession } from '../modules/auth/auth.service.js';

export const SESSION_COOKIE = 'cxr_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      doctor?: { id: string; role: Role; fullName: string; email: string };
    }
  }
}

export function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    // Unreadable from JavaScript, so an XSS bug cannot exfiltrate the session.
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') {
    next(unauthorized());
    return;
  }

  const payload = verifySession(token);

  prisma.doctor
    .findUnique({ where: { id: payload.sub } })
    .then((doctor) => {
      // Re-read on every request so deactivating an account takes effect immediately
      // instead of when the token happens to expire.
      if (!doctor || !doctor.isActive) {
        next(unauthorized('Your account is no longer active.'));
        return;
      }
      req.doctor = {
        id: doctor.id,
        role: doctor.role,
        fullName: doctor.fullName,
        email: doctor.email,
      };
      next();
    })
    .catch(next);
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.doctor) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.doctor.role)) {
      next(forbidden('This action requires elevated permissions.'));
      return;
    }
    next();
  };
}

/** Narrowing helper for handlers mounted behind {@link requireAuth}. */
export function currentDoctor(req: Request): NonNullable<Request['doctor']> {
  if (!req.doctor) throw unauthorized();
  return req.doctor;
}
