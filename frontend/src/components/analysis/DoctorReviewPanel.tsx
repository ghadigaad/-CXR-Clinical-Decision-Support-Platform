import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Lock, Save } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '../../api/client';
import { analysesApi, queryKeys } from '../../api/resources';
import { formatDateTime } from '../../lib/utils';
import type { Analysis } from '../../types/api';
import { Alert } from '../ui/Alert';
import { ClinicianBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/Card';
import { TextAreaField } from '../ui/Field';
import { useToast } from '../ui/Toast';

/**
 * Doctor review and sign-off.
 *
 * Finalizing requires a written final assessment: the clinician's own conclusion is the
 * authoritative part of the record, and the system should not let a report be signed
 * that contains only model output.
 */
export function DoctorReviewPanel({ analysis }: { analysis: Analysis }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const isFinalized = analysis.status === 'FINALIZED';

  const [comments, setComments] = useState(analysis.review?.comments ?? '');
  const [additionalFindings, setAdditionalFindings] = useState(
    analysis.review?.additionalFindings ?? '',
  );
  const [finalAssessment, setFinalAssessment] = useState(
    analysis.review?.finalAssessment ?? '',
  );
  const [agreesWithAi, setAgreesWithAi] = useState<boolean | null>(
    analysis.review?.agreesWithAi ?? null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(analysis.id) });
    void queryClient.invalidateQueries({ queryKey: ['analyses'] });
    void queryClient.invalidateQueries({ queryKey: ['patients'] });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      analysesApi.review(analysis.id, {
        comments: comments || undefined,
        additionalFindings: additionalFindings || undefined,
        finalAssessment: finalAssessment || undefined,
        agreesWithAi,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Review saved');
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () =>
      analysesApi.finalize(analysis.id, {
        comments: comments || undefined,
        additionalFindings: additionalFindings || undefined,
        finalAssessment,
        agreesWithAi,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Report finalized', 'The report is now locked and ready to share.');
    },
  });

  const error = saveMutation.error ?? finalizeMutation.error;
  const errorMessage = error instanceof ApiError ? error.message : null;

  if (isFinalized) {
    return (
      <Card className="border-emerald-200">
        <CardHeader
          title="Doctor review"
          description="This report has been finalized and is locked."
          actions={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <Lock className="size-3" aria-hidden />
              Finalized
            </span>
          }
          className="bg-emerald-50/40"
        />
        <CardBody className="space-y-4">
          {analysis.review?.finalAssessment ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Final assessment
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {analysis.review.finalAssessment}
              </p>
            </div>
          ) : null}

          {analysis.review?.additionalFindings ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Additional findings
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {analysis.review.additionalFindings}
              </p>
            </div>
          ) : null}

          {analysis.review?.comments ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Comments
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {analysis.review.comments}
              </p>
            </div>
          ) : null}

          {analysis.review?.agreesWithAi !== null &&
          analysis.review?.agreesWithAi !== undefined ? (
            <p className="text-sm text-slate-600">
              Clinician{' '}
              <strong className="font-semibold">
                {analysis.review.agreesWithAi ? 'agrees' : 'does not agree'}
              </strong>{' '}
              with the AI prediction.
            </p>
          ) : null}

          {analysis.report?.finalizedAt ? (
            <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
              Signed by {analysis.report.finalizedByName ?? 'the reviewing clinician'} on{' '}
              {formatDateTime(analysis.report.finalizedAt)}.
            </p>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Doctor review"
        description="Your assessment is the authoritative part of this report."
        actions={<ClinicianBadge label="Your input" />}
      />

      <CardBody className="space-y-5">
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {validationError ? <Alert tone="warning">{validationError}</Alert> : null}

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">
            Do you agree with the AI prediction?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { value: true, label: 'Agree' },
              { value: false, label: 'Disagree' },
              { value: null, label: 'Not stated' },
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => setAgreesWithAi(option.value)}
                aria-pressed={agreesWithAi === option.value}
                className={
                  agreesWithAi === option.value
                    ? 'rounded-lg border border-clinical-600 bg-clinical-50 px-3 py-1.5 text-sm font-medium text-clinical-700'
                    : 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <TextAreaField
          label="Additional findings"
          rows={3}
          placeholder="Findings you observed that the model did not report."
          value={additionalFindings}
          onChange={(event) => setAdditionalFindings(event.target.value)}
        />

        <TextAreaField
          label="Comments"
          rows={3}
          placeholder="Notes on image quality, clinical correlation, limitations…"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
        />

        <TextAreaField
          label="Final assessment"
          rows={4}
          required
          placeholder="Your clinical conclusion for this study."
          hint="Required to finalize. This is what the report presents as the clinical conclusion."
          value={finalAssessment}
          onChange={(event) => setFinalAssessment(event.target.value)}
        />
      </CardBody>

      <CardFooter>
        <Button
          variant="secondary"
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          disabled={finalizeMutation.isPending}
          leftIcon={<Save className="size-4" aria-hidden />}
        >
          Save draft
        </Button>

        <Button
          variant="success"
          onClick={() => {
            if (!finalAssessment.trim()) {
              setValidationError('Enter a final assessment before finalizing the report.');
              return;
            }
            setValidationError(null);
            finalizeMutation.mutate();
          }}
          isLoading={finalizeMutation.isPending}
          disabled={saveMutation.isPending}
          leftIcon={<CheckCircle2 className="size-4" aria-hidden />}
        >
          Approve and finalize
        </Button>
      </CardFooter>
    </Card>
  );
}
