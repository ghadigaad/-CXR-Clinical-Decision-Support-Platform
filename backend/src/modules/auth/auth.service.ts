import type { Doctor, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { unauthorized } from '../../lib/errors.js';

const BCRYPT_ROUNDS = 12;

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

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
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

export async function authenticate(email: string, password: string): Promise<Doctor> {
  const doctor = await prisma.doctor.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Compare against a dummy hash when the account is missing so response timing does
  // not reveal which email addresses are registered.
  const hash = doctor?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const matches = await bcrypt.compare(password, hash);

  if (!doctor || !matches || !doctor.isActive) {
    throw unauthorized('Incorrect email or password.');
  }

  return prisma.doctor.update({
    where: { id: doctor.id },
    data: { lastLoginAt: new Date() },
  });
}
