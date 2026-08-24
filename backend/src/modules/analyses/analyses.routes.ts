import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import { badRequest, notFound, reportFinalized } from '../../lib/errors.js';
import { serializeAnalysis } from '../../lib/serializers.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { currentDoctor, requireAuth } from '../../middleware/auth.js';
import { analyzeLimiter } from '../../middleware/rateLimit.js';
import { uploadCxrImage } from '../../middleware/upload.js';
import { analyzeCXR } from '../../services/aiService.js';
import {
  createDisplayImage,
  createThumbnail,
  persistOriginal,
  retainHeatmap,
  sanitizeUpload,
} from '../../services/imageService.js';
import { AI_DISCLAIMER, buildReportContent } from '../../services/reportBuilder.js';
import {
  analyzeRequestSchema,
  finalizeSchema,
  listAnalysesSchema,
  reviewSchema,
} from './analyses.schema.js';
import { claimRequest, releaseRequest, resolveRequest } from './idempotency.js';

export const analysesRouter = Router();
export const analyzeRouter = Router();

analysesRouter.use(requireAuth);
analyzeRouter.use(requireAuth);

/* -------------------------------------------------------------------------- */
/* POST /api/analyze                                                          */
/* -------------------------------------------------------------------------- */

analyzeRouter.post(
  '/',
  analyzeLimiter,
  uploadCxrImage,
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const { patientId, requestId, modelId } = analyzeRequestSchema.parse(req.body);

    if (!req.file) {
      throw badRequest('A chest X-ray image is required.');
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: doctor.id },
    });
    if (!patient) throw notFound('Patient not found.');

    // Server-side guard against duplicate submissions: a repeat of an in-flight or
    // just-completed requestId returns the original analysis rather than re-running
    // inference and creating a second record for the same click.
    if (requestId) {
      const existingId = resolveRequest(doctor.id, requestId);
      if (existingId) {
        const existing = await prisma.analysis.findUnique({
          where: { id: existingId },
          include: { patient: true, report: true, review: true },
        });
        if (existing) {
          res.status(200).json({
            analysis: serializeAnalysis(existing),
            disclaimer: AI_DISCLAIMER,
            duplicate: true,
          });
          return;
        }
      }
      claimRequest(doctor.id, requestId);
    }

    try {
      const image = await sanitizeUpload(req.file.buffer, req.file.originalname);

      const result = await analyzeCXR({
        imageBuffer: image.buffer,
        mimeType: image.mimeType,
        fileName: 'cxr-upload',
        modelId,
        patientContext: {
          age: patient.age,
          gender: patient.gender,
          hasClinicalHistory: Boolean(patient.clinicalHistory),
          hasSymptoms: Boolean(patient.symptoms),
        },
      });

      const content = buildReportContent(result);
      const [thumbnail, displayImage, originalPath] = await Promise.all([
        createThumbnail(image),
        createDisplayImage(image),
        persistOriginal(image),
      ]);

      const analysis = await prisma.analysis.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          predictedLabel: result.predictedLabel,
          predictedIndex: result.predictedIndex,
          confidence: result.confidence,
          probabilitiesJson: JSON.stringify(result.probabilities),
          modelVersion: result.modelVersion,
          processingTimeMs: result.processingTimeMs,
          source: result.source,
          riskLevel: content.riskLevel,
          imageMimeType: image.mimeType,
          imageWidth: image.width,
          imageHeight: image.height,
          imageByteSize: image.byteSize,
          imageChecksum: image.checksum,
          thumbnailDataUrl: thumbnail,
          displayImageDataUrl: displayImage,
          heatmapDataUrl: retainHeatmap(result.gradcam),
          originalImagePath: originalPath,
          report: {
            create: {
              impression: content.impression,
              observationsJson: JSON.stringify(content.observations),
              recommendationsJson: JSON.stringify(content.recommendations),
            },
          },
        },
        include: { patient: true, report: true, review: true },
      });

      if (requestId) {
        releaseRequest(doctor.id, requestId, analysis.id);
      }

      await recordAudit({
        doctorId: doctor.id,
        action: 'analysis.create',
        entityType: 'Analysis',
        entityId: analysis.id,
        metadata: {
          modelId: modelId ?? 'densenet-cbam',
          modelVersion: result.modelVersion,
          source: result.source,
          imageRetained: Boolean(originalPath),
        },
        req,
      });

      const serialized = serializeAnalysis(analysis);

      res.status(201).json({
        analysis: {
          ...serialized,
          image: {
            ...serialized.image,
            // Deployments that retain nothing still get the heatmap for this session, so
            // the clinician can inspect it now even though it will not persist.
            heatmap: result.gradcam,
          },
        },
        disclaimer: AI_DISCLAIMER,
        duplicate: false,
      });
    } catch (error) {
      if (requestId) releaseRequest(doctor.id, requestId, null);
      throw error;
    }
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/analyses                                                          */
/* -------------------------------------------------------------------------- */

analysesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const query = listAnalysesSchema.parse(req.query);

    const where: Prisma.AnalysisWhereInput = {
      doctorId: doctor.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.prediction ? { predictedLabel: query.prediction } : {}),
      ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            patient: {
              OR: [
                { fullName: { contains: query.search } },
                { medicalRecordNumber: { contains: query.search } },
              ],
            },
          }
        : {}),
    };

    const [total, analyses] = await Promise.all([
      prisma.analysis.count({ where }),
      prisma.analysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { patient: true, report: true, review: true },
      }),
    ]);

    res.json({
      analyses: analyses.map((analysis) =>
        serializeAnalysis(analysis, { includeHeatmap: false, includeDisplayImage: false }),
      ),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/analyses/stats                                                    */
/* -------------------------------------------------------------------------- */

analysesRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [patientCount, totalAnalyses, thisWeek, pendingReview, finalized, byPrediction] =
      await Promise.all([
        prisma.patient.count({ where: { doctorId: doctor.id } }),
        prisma.analysis.count({ where: { doctorId: doctor.id } }),
        prisma.analysis.count({ where: { doctorId: doctor.id, createdAt: { gte: weekAgo } } }),
        prisma.analysis.count({ where: { doctorId: doctor.id, status: 'PENDING_REVIEW' } }),
        prisma.analysis.count({ where: { doctorId: doctor.id, status: 'FINALIZED' } }),
        prisma.analysis.groupBy({
          by: ['predictedLabel'],
          where: { doctorId: doctor.id },
          _count: { _all: true },
        }),
      ]);

    res.json({
      stats: {
        patientCount,
        totalAnalyses,
        analysesThisWeek: thisWeek,
        pendingReview,
        finalized,
        predictionBreakdown: byPrediction
          .map((row) => ({ label: row.predictedLabel, count: row._count._all }))
          .sort((a, b) => b.count - a.count),
      },
    });
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/analyses/:id                                                      */
/* -------------------------------------------------------------------------- */

async function findOwnedAnalysis(analysisId: string, doctorId: string) {
  const analysis = await prisma.analysis.findFirst({
    where: { id: analysisId, doctorId },
    include: { patient: true, report: true, review: true },
  });
  if (!analysis) throw notFound('Analysis not found.');
  return analysis;
}

analysesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const analysis = await findOwnedAnalysis(req.params.id as string, doctor.id);

    res.json({ analysis: serializeAnalysis(analysis), disclaimer: AI_DISCLAIMER });
  }),
);

analysesRouter.get(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const analysis = await findOwnedAnalysis(req.params.id as string, doctor.id);

    await recordAudit({
      doctorId: doctor.id,
      action: 'report.view',
      entityType: 'Analysis',
      entityId: analysis.id,
      req,
    });

    res.json({
      analysis: serializeAnalysis(analysis),
      disclaimer: AI_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    });
  }),
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/analyses/:id/review                                             */
/* -------------------------------------------------------------------------- */

analysesRouter.patch(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const input = reviewSchema.parse(req.body);
    const analysis = await findOwnedAnalysis(req.params.id as string, doctor.id);

    if (analysis.status === 'FINALIZED') throw reportFinalized();

    const data = {
      comments: input.comments ?? null,
      additionalFindings: input.additionalFindings ?? null,
      finalAssessment: input.finalAssessment ?? null,
      agreesWithAi: input.agreesWithAi ?? null,
    };

    const updated = await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status: 'REVIEWED',
        review: {
          upsert: {
            create: { ...data, doctorId: doctor.id },
            update: data,
          },
        },
      },
      include: { patient: true, report: true, review: true },
    });

    await recordAudit({
      doctorId: doctor.id,
      action: 'analysis.review',
      entityType: 'Analysis',
      entityId: analysis.id,
      req,
    });

    res.json({ analysis: serializeAnalysis(updated) });
  }),
);

/* -------------------------------------------------------------------------- */
/* POST /api/analyses/:id/finalize                                            */
/* -------------------------------------------------------------------------- */

analysesRouter.post(
  '/:id/finalize',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const input = finalizeSchema.parse(req.body);
    const analysis = await findOwnedAnalysis(req.params.id as string, doctor.id);

    if (analysis.status === 'FINALIZED') throw reportFinalized();
    if (!analysis.report) {
      throw badRequest('This analysis has no report to finalize.');
    }

    const reviewData = {
      comments: input.comments ?? null,
      additionalFindings: input.additionalFindings ?? null,
      finalAssessment: input.finalAssessment,
      agreesWithAi: input.agreesWithAi ?? null,
    };

    const updated = await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status: 'FINALIZED',
        review: {
          upsert: { create: { ...reviewData, doctorId: doctor.id }, update: reviewData },
        },
        report: {
          update: {
            finalizedAt: new Date(),
            // Snapshot the signer so the report stays truthful if the account changes.
            finalizedByName: doctor.fullName,
            finalizedById: doctor.id,
          },
        },
      },
      include: { patient: true, report: true, review: true },
    });

    await recordAudit({
      doctorId: doctor.id,
      action: 'report.finalize',
      entityType: 'Analysis',
      entityId: analysis.id,
      req,
    });

    res.json({ analysis: serializeAnalysis(updated) });
  }),
);
