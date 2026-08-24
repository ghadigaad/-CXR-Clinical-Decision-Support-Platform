import type { Request } from 'express';

import { logger } from '../config/logger.js';
import { prisma } from '../config/prisma.js';

interface AuditInput {
  doctorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Identifiers and outcome metadata only - never patient fields. */
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Append-only access trail. Failures are logged but never propagated: an audit write
 * problem must not roll back or block the clinical action the user just performed.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        doctorId: input.doctorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.req?.ip ?? null,
      },
    });
  } catch (error) {
    logger.warn('Failed to write audit log', {
      action: input.action,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
