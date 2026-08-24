import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { analysesApi, queryKeys } from '../../api/resources';
import { DoctorReviewPanel } from '../../components/analysis/DoctorReviewPanel';
import { PageHeader } from '../../components/layout/AppLayout';
import {
  AI_DISCLAIMER,
  MockOutputWarning,
  RESPONSIBILITY_NOTE,
} from '../../components/safety/Disclaimers';
import { Alert } from '../../components/ui/Alert';
import { AiBadge, ClinicianBadge, RiskBadge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import {
  formatDate,
  formatDateTime,
  formatGender,
  formatPercent,
} from '../../lib/utils';
import type { Analysis } from '../../types/api';

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="print-block border-t border-slate-200 px-6 py-5 first:border-t-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{value}</p>
    </div>
  );
}

function ReportBody({ analysis }: { analysis: Analysis }) {
  const patient = analysis.patient;
  const report = analysis.report;
  const review = analysis.review;
  const isFinalized = analysis.status === 'FINALIZED';

  const ranked = [...analysis.prediction.probabilities].sort(
    (a, b) => b.probability - a.probability,
  );
  const displayImage = analysis.image.display ?? analysis.image.thumbnail;

  return (
    <Card className="overflow-hidden">
      <div className="print-block border-b-2 border-clinical-600 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Chest Radiograph Report</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              AI-assisted clinical decision support
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={analysis.status} />
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(analysis.createdAt)}</p>
          </div>
        </div>
      </div>

      {!isFinalized ? (
        <div className="print-block bg-amber-50 px-6 py-3 text-sm text-amber-900">
          This report is a <strong>draft</strong> and has not been reviewed and signed by a
          clinician.
        </div>
      ) : null}

      {patient ? (
        <Section title="Patient information" badge={<ClinicianBadge />}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <Detail label="Name" value={<strong className="font-semibold">{patient.fullName}</strong>} />
            <Detail
              label="Patient ID"
              value={<span className="font-mono">{patient.medicalRecordNumber}</span>}
            />
            <Detail label="Analysis date" value={formatDateTime(analysis.createdAt)} />
            <Detail label="Age" value={`${patient.age} years`} />
            <Detail label="Gender" value={formatGender(patient.gender)} />
            <Detail label="Date of birth" value={formatDate(patient.dateOfBirth)} />
          </dl>
        </Section>
      ) : null}

      {patient && (patient.clinicalHistory || patient.symptoms || patient.notes) ? (
        <Section title="Clinical information" badge={<ClinicianBadge />}>
          <TextBlock label="Clinical history" value={patient.clinicalHistory} />
          <TextBlock label="Presenting symptoms" value={patient.symptoms} />
          <TextBlock label="Notes" value={patient.notes} />
        </Section>
      ) : null}

      <Section title="Imaging">
        {displayImage ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              <img
                src={displayImage}
                alt="Chest radiograph as submitted"
                className="w-full rounded-lg border border-slate-200 bg-slate-950 object-contain"
              />
              <figcaption className="mt-1.5 text-xs text-slate-500">
                Chest radiograph as submitted
              </figcaption>
            </figure>
            {analysis.image.heatmap ? (
              <figure>
                <img
                  src={analysis.image.heatmap}
                  alt="Grad-CAM heatmap showing regions that influenced the prediction"
                  className="w-full rounded-lg border border-slate-200 bg-slate-950 object-contain"
                />
                <figcaption className="mt-1.5 text-xs text-slate-500">
                  Grad-CAM: regions influencing the prediction
                </figcaption>
              </figure>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            The chest radiograph was not retained by this deployment. Image checksum
            (SHA-256):{' '}
            <span className="break-all font-mono text-xs">{analysis.image.checksum}</span>
          </p>
        )}
      </Section>

      <Section title="AI findings" badge={<AiBadge />}>
        <div className="rounded-lg border border-ai-200 bg-ai-50/50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Prediction
              </p>
              <p className="mt-0.5 text-xl font-semibold text-slate-900">
                {analysis.prediction.label}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Confidence
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ai-700">
                {formatPercent(analysis.prediction.confidence)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Risk level
              </p>
              <div className="mt-1">
                <RiskBadge risk={analysis.riskLevel} />
              </div>
            </div>
          </div>

          <dl className="mt-4 divide-y divide-ai-100 border-t border-ai-100">
            {ranked.map((item) => (
              <div key={item.label} className="flex justify-between py-1.5">
                <dt className="text-sm text-slate-700">{item.label}</dt>
                <dd className="text-sm font-medium tabular-nums text-slate-900">
                  {formatPercent(item.probability)}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-xs text-slate-500">
            Risk level is derived by the reporting system from the model’s confidence; it is not
            an output of the model. Model:{' '}
            <span className="font-medium">
              {analysis.modelName ?? analysis.modelVersion}
            </span>
            {' '}
            <span className="font-mono">({analysis.modelVersion})</span>
          </p>
        </div>

        {report && report.observations.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Observations
            </p>
            <ul className="mt-1.5 space-y-1">
              {report.observations.map((observation) => (
                <li key={observation} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                  {observation}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {report?.impression ? (
        <Section title="Impression" badge={<AiBadge />}>
          <p className="text-sm leading-relaxed text-slate-800">{report.impression}</p>
        </Section>
      ) : null}

      {report && report.recommendations.length > 0 ? (
        <Section title="Recommendations" badge={<AiBadge />}>
          <ul className="space-y-1">
            {report.recommendations.map((recommendation) => (
              <li key={recommendation} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                {recommendation}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Clinician review" badge={<ClinicianBadge />}>
        {review?.finalAssessment ? (
          <TextBlock label="Final assessment" value={review.finalAssessment} />
        ) : (
          <p className="text-sm text-amber-700">
            No final clinical assessment has been recorded. This report is a draft.
          </p>
        )}
        <TextBlock label="Additional findings" value={review?.additionalFindings} />
        <TextBlock label="Comments" value={review?.comments} />

        {review?.agreesWithAi !== null && review?.agreesWithAi !== undefined ? (
          <p className="mt-3 text-sm text-slate-700">
            Reviewing clinician{' '}
            <strong className="font-semibold">
              {review.agreesWithAi ? 'agrees' : 'does not agree'}
            </strong>{' '}
            with the AI prediction.
          </p>
        ) : null}

        {isFinalized && report?.finalizedAt ? (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Electronically signed by {report.finalizedByName ?? 'reviewing clinician'} on{' '}
            {formatDateTime(report.finalizedAt)}.
          </p>
        ) : null}
      </Section>

      <div className="print-block border-t border-slate-200 bg-slate-50 px-6 py-4">
        <p className="text-xs font-semibold text-slate-700">Important</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {AI_DISCLAIMER} {RESPONSIBILITY_NOTE}
        </p>
      </div>
    </Card>
  );
}

export function ReportPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.analysis(analysisId ?? ''), 'report'],
    queryFn: () => analysesApi.report(analysisId as string),
    enabled: Boolean(analysisId),
  });

  async function handleDownload() {
    if (!data) return;
    setIsExporting(true);
    try {
      // The PDF renderer is a large dependency and most sessions never export, so it is
      // loaded on demand instead of shipping in the initial bundle.
      const { generateReportPdf } = await import('./generateReportPdf');
      const blob = await generateReportPdf(data.analysis);
      const url = URL.createObjectURL(blob);

      const patientRef = data.analysis.patient?.medicalRecordNumber ?? data.analysis.id;
      const date = new Date(data.analysis.createdAt).toISOString().slice(0, 10);

      const link = document.createElement('a');
      link.href = url;
      link.download = `CXR-Report-${patientRef}-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Release the blob once the download has been handed to the browser.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Report downloaded');
    } catch {
      toast.error('Could not generate the PDF', 'Try printing to PDF from your browser instead.');
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Medical report" />
        <Skeleton className="h-[42rem] w-full rounded-xl" />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Medical report" />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const { analysis } = data;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Medical report"
          description={
            analysis.patient
              ? `${analysis.patient.fullName} · ${analysis.patient.medicalRecordNumber}`
              : undefined
          }
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => navigate(`/analysis/${analysis.id}`)}
                leftIcon={<ArrowLeft className="size-4" aria-hidden />}
              >
                Back to result
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.print()}
                leftIcon={<Printer className="size-4" aria-hidden />}
              >
                Print report
              </Button>
              <Button
                onClick={handleDownload}
                isLoading={isExporting}
                leftIcon={<Download className="size-4" aria-hidden />}
              >
                Download PDF
              </Button>
            </>
          }
        />

        <div className="mb-6 space-y-4">
          <MockOutputWarning source={analysis.source} />
          {analysis.status !== 'FINALIZED' ? (
            <Alert tone="warning" title="Draft report">
              Review the AI output and record your final assessment below to finalize this
              report.
            </Alert>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        <ReportBody analysis={analysis} />

        <div className="no-print">
          <DoctorReviewPanel analysis={analysis} />
        </div>
      </div>
    </>
  );
}
