import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '../../api/client';
import { patientsApi, queryKeys, type PatientInput } from '../../api/resources';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../../components/ui/Card';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import type { Patient } from '../../types/api';

/**
 * Only fields with a clinical purpose are collected. There is deliberately no address,
 * phone number, insurance, or national identifier: none of it informs the model or the
 * report, and every extra identifier increases the blast radius of a breach.
 */
const schema = z.object({
  medicalRecordNumber: z
    .string()
    .trim()
    .min(1, 'Patient ID is required.')
    .max(64, 'Patient ID must be 64 characters or fewer.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter the patient’s full name.')
    .max(120, 'Name must be 120 characters or fewer.'),
  age: z
    .coerce.number({ invalid_type_error: 'Enter the patient’s age.' })
    .int('Age must be a whole number.')
    .min(0, 'Age cannot be negative.')
    .max(130, 'Enter a valid age.'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'], {
    errorMap: () => ({ message: 'Select a gender.' }),
  }),
  dateOfBirth: z
    .string()
    .optional()
    .refine(
      (value) => !value || new Date(value) <= new Date(),
      'Date of birth cannot be in the future.',
    ),
  clinicalHistory: z.string().max(4000, 'Must be 4000 characters or fewer.').optional(),
  symptoms: z.string().max(4000, 'Must be 4000 characters or fewer.').optional(),
  notes: z.string().max(4000, 'Must be 4000 characters or fewer.').optional(),
});

export type PatientFormValues = z.infer<typeof schema>;

const GENDER_OPTIONS = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNDISCLOSED', label: 'Prefer not to say' },
];

interface PatientFormProps {
  patient?: Patient | null;
  onSaved: (patient: Patient) => void;
  submitLabel?: string;
  description?: string;
  secondaryAction?: React.ReactNode;
}

export function PatientForm({
  patient,
  onSaved,
  submitLabel = 'Save patient',
  description = 'Recorded alongside the analysis and included in the generated report.',
  secondaryAction,
}: PatientFormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      medicalRecordNumber: patient?.medicalRecordNumber ?? '',
      fullName: patient?.fullName ?? '',
      age: patient?.age ?? undefined,
      gender: patient?.gender ?? undefined,
      dateOfBirth: patient?.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
      clinicalHistory: patient?.clinicalHistory ?? '',
      symptoms: patient?.symptoms ?? '',
      notes: patient?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: PatientFormValues) => {
      const payload: PatientInput = {
        ...values,
        dateOfBirth: values.dateOfBirth || undefined,
        clinicalHistory: values.clinicalHistory || undefined,
        symptoms: values.symptoms || undefined,
        notes: values.notes || undefined,
      };
      return patient
        ? patientsApi.update(patient.id, payload)
        : patientsApi.create(payload);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      toast.success(patient ? 'Patient updated' : 'Patient saved');
      onSaved(result.patient);
    },
    onError: (error) => {
      // A duplicate patient ID is the common case; attach it to the field rather than
      // surfacing it only as a banner the clinician has to interpret.
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        setError('medicalRecordNumber', { message: error.message });
        return;
      }
      if (error instanceof ApiError) {
        for (const issue of error.issues) {
          setError(issue.field as keyof PatientFormValues, { message: issue.message });
        }
      }
    },
  });

  const generalError =
    mutation.error instanceof ApiError && mutation.error.code !== 'CONFLICT'
      ? mutation.error.message
      : null;

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Card>
        <CardHeader title="Patient information" description={description} />

        <CardBody className="space-y-5">
          {generalError ? <Alert tone="danger">{generalError}</Alert> : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Patient ID"
              required
              placeholder="e.g. MRN-104882"
              hint="Your local medical record number."
              error={errors.medicalRecordNumber?.message}
              {...register('medicalRecordNumber')}
            />
            <TextField
              label="Full name"
              required
              autoComplete="off"
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <TextField
              label="Age"
              type="number"
              min={0}
              max={130}
              required
              error={errors.age?.message}
              {...register('age')}
            />
            <SelectField
              label="Gender"
              required
              placeholder="Select…"
              options={GENDER_OPTIONS}
              error={errors.gender?.message}
              {...register('gender')}
            />
            <TextField
              label="Date of birth"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              error={errors.dateOfBirth?.message}
              containerClassName="sm:col-span-2 sm:max-w-xs"
              {...register('dateOfBirth')}
            />
          </div>

          <div className="space-y-5 border-t border-slate-100 pt-5">
            <TextAreaField
              label="Clinical history"
              rows={3}
              placeholder="Relevant past medical history, comorbidities, prior imaging…"
              error={errors.clinicalHistory?.message}
              {...register('clinicalHistory')}
            />
            <TextAreaField
              label="Presenting symptoms"
              rows={3}
              placeholder="Cough, fever, dyspnoea, duration…"
              error={errors.symptoms?.message}
              {...register('symptoms')}
            />
            <TextAreaField
              label="Additional notes"
              rows={2}
              placeholder="Anything else relevant to interpreting this study."
              error={errors.notes?.message}
              {...register('notes')}
            />
          </div>
        </CardBody>

        <CardFooter>
          {secondaryAction}
          <Button
            type="submit"
            isLoading={mutation.isPending}
            leftIcon={<Save className="size-4" aria-hidden />}
            disabled={Boolean(patient) && !isDirty}
          >
            {submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
