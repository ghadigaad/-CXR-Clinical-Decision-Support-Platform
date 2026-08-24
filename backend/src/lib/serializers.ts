/**
 * Shapes Prisma records into API responses.
 *
 * Two jobs: keep internal columns (password hashes, storage paths) out of responses,
 * and expand the JSON-as-string columns that keep the schema portable between SQLite
 * and Postgres.
 */
import type { Analysis, Patient, Report, Review } from '@prisma/client';

import type { ClassProbability } from '../services/ai/types.js';
import { modelNameFromVersion } from '../services/ai/catalog.js';

function parseJsonArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function serializePatient(patient: Patient) {
  return {
    id: patient.id,
    medicalRecordNumber: patient.medicalRecordNumber,
    fullName: patient.fullName,
    age: patient.age,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth?.toISOString() ?? null,
    clinicalHistory: patient.clinicalHistory,
    symptoms: patient.symptoms,
    notes: patient.notes,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

export function serializeReview(review: Review | null | undefined) {
  if (!review) return null;
  return {
    id: review.id,
    comments: review.comments,
    additionalFindings: review.additionalFindings,
    finalAssessment: review.finalAssessment,
    agreesWithAi: review.agreesWithAi,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export function serializeReport(report: Report | null | undefined) {
  if (!report) return null;
  return {
    id: report.id,
    impression: report.impression,
    observations: parseJsonArray<string>(report.observationsJson, []),
    recommendations: parseJsonArray<string>(report.recommendationsJson, []),
    finalizedAt: report.finalizedAt?.toISOString() ?? null,
    finalizedByName: report.finalizedByName,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

type AnalysisWithRelations = Analysis & {
  patient?: Patient | null;
  report?: Report | null;
  review?: Review | null;
};

interface SerializeAnalysisOptions {
  /**
   * Heatmaps and display renditions are large base64 payloads. List endpoints omit them
   * and send only thumbnails, so a page of results stays a reasonable size.
   */
  includeHeatmap?: boolean;
  includeThumbnail?: boolean;
  includeDisplayImage?: boolean;
}

export function serializeAnalysis(
  analysis: AnalysisWithRelations,
  options: SerializeAnalysisOptions = {},
) {
  const {
    includeHeatmap = true,
    includeThumbnail = true,
    includeDisplayImage = true,
  } = options;
  const probabilities = parseJsonArray<ClassProbability>(analysis.probabilitiesJson, []);

  return {
    id: analysis.id,
    status: analysis.status,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),

    prediction: {
      label: analysis.predictedLabel,
      classIndex: analysis.predictedIndex,
      confidence: analysis.confidence,
      probabilities,
    },
    riskLevel: analysis.riskLevel,
    modelName: modelNameFromVersion(analysis.modelVersion),
    modelVersion: analysis.modelVersion,
    processingTimeMs: analysis.processingTimeMs,
    source: analysis.source as 'model' | 'mock',

    image: {
      mimeType: analysis.imageMimeType,
      width: analysis.imageWidth,
      height: analysis.imageHeight,
      byteSize: analysis.imageByteSize,
      checksum: analysis.imageChecksum,
      thumbnail: includeThumbnail ? analysis.thumbnailDataUrl : null,
      display: includeDisplayImage ? analysis.displayImageDataUrl : null,
      heatmap: includeHeatmap ? analysis.heatmapDataUrl : null,
      // Signals to the UI whether pixels were retained at all in this deployment.
      retained: Boolean(analysis.originalImagePath),
    },

    patient: analysis.patient ? serializePatient(analysis.patient) : null,
    report: serializeReport(analysis.report),
    review: serializeReview(analysis.review),
  };
}

export type SerializedAnalysis = ReturnType<typeof serializeAnalysis>;
