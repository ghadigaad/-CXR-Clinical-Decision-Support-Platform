import { z } from 'zod';

export const genderValues = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer.`)
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const createPatientSchema = z.object({
  medicalRecordNumber: z
    .string()
    .trim()
    .min(1, 'Patient ID is required.')
    .max(64, 'Patient ID must be 64 characters or fewer.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name is required.')
    .max(120, 'Full name must be 120 characters or fewer.'),
  age: z
    .number({ invalid_type_error: 'Age must be a number.' })
    .int('Age must be a whole number.')
    .min(0, 'Age cannot be negative.')
    .max(130, 'Enter a valid age.'),
  gender: z.enum(genderValues, { errorMap: () => ({ message: 'Select a gender.' }) }),
  dateOfBirth: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => !value || !Number.isNaN(value.getTime()), 'Enter a valid date of birth.')
    .refine((value) => !value || value <= new Date(), 'Date of birth cannot be in the future.'),
  clinicalHistory: optionalText(4000),
  symptoms: optionalText(4000),
  notes: optionalText(4000),
});

export const updatePatientSchema = createPatientSchema.partial();

export const listPatientsSchema = z.object({
  // Free-text search. Sent as a query parameter, but it only ever holds what the
  // clinician typed - patient records are addressed by opaque id elsewhere.
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
