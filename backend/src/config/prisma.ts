import { PrismaClient } from '@prisma/client';

import { env, isProduction } from './env.js';

/**
 * Reused across hot reloads so `tsx watch` does not open a new connection pool on
 * every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.LOG_LEVEL === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
