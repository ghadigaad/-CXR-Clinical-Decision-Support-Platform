import type { Doctor, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { unauthorized } from '../../lib/errors.js';

export interface SessionPayload {
  sub: string;
  role: Role;
}

export interface PublicDoctor {
  id: string;
  email: string;
  fullName: string;
  specialty: string | null;
  licenseId: string | null;
  role: Role;
  lastLoginAt: Date | null;
}

export function toPublicDoctor(doctor: Doctor): PublicDoctor {
  return {
    id: doctor.id,
    email: doctor.email,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    licenseId: doctor.licenseId,
    role: doctor.role,
    lastLoginAt: doctor.lastLoginAt,
  };
}

export function signSession(doctor: Doctor): string {
  const payload: SessionPayload = { sub: doctor.id, role: doctor.role };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifySession(token: string): SessionPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'clinician';
  const spaced = local.replace(/[._-]+/g, ' ').trim();
  if (!spaced) return 'Clinician';
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function requestEmailOtp(email: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    throw unauthorized(
      'Could not send a sign-in code. Check the address and try again in a few minutes.',
    );
  }
}

export async function verifyEmailOtp(email: string, token: string): Promise<Doctor> {
  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error || !data.user?.email) {
    throw unauthorized('That code is invalid or has expired. Request a new one.');
  }

  const normalized = data.user.email.toLowerCase().trim();

  const doctor = await prisma.doctor.upsert({
    where: { email: normalized },
    update: { lastLoginAt: new Date(), isActive: true },
    create: {
      email: normalized,
      fullName: displayNameFromEmail(normalized),
      specialty: null,
      role: 'DOCTOR',
      passwordHash: '',
      lastLoginAt: new Date(),
    },
  });

  if (!doctor.isActive) {
    throw unauthorized('Your account is no longer active.');
  }

  return doctor;
}
