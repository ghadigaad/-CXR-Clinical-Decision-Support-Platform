import { z } from 'zod';

export const analyzeRequestSchema = z.object({
  patientId: z.string().min(1, 'A saved patient is required before analysis.'),
  /**
   * Client-generated idempotency key. Two submissions of the same key within the dedupe
   * window resolve to the same analysis instead of running inference twice, which
   * protects against double-clicks and retries on a slow connection.
   */
  requestId: z.string().uuid().optional(),
  /** Which trained classifier to run. Defaults to DenseNet-121 + CBAM. */
  modelId: z.enum(['densenet-cbam', 'efficientnetv2']).optional(),
});

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer.`)
    .trim()
    .optional()
    .transform((value) => (value === '' ? null : (value ?? null)));

export const reviewSchema = z
  .object({
    comments: optionalText(5000),
    additionalFindings: optionalText(5000),
    finalAssessment: optionalText(5000),
    agreesWithAi: z.boolean().nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== null && field !== undefined),
    'Provide at least one review field.',
  );

export const finalizeSchema = z.object({
  finalAssessment: z
    .string()
    .trim()
    .min(1, 'A final assessment is required before finalizing the report.')
    .max(5000),
  comments: optionalText(5000),
  additionalFindings: optionalText(5000),
  agreesWithAi: z.boolean().nullable().optional(),
});

export const listAnalysesSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING_REVIEW', 'REVIEWED', 'FINALIZED']).optional(),
  prediction: z.string().trim().max(64).optional(),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
