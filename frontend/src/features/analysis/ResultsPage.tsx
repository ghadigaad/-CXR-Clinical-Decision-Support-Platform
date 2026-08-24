import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { analysesApi, queryKeys } from '../../api/resources';
import { DoctorReviewPanel } from '../../components/analysis/DoctorReviewPanel';
import { FindingsCard } from '../../components/analysis/FindingsCard';
import { PatientInfoCard } from '../../components/analysis/PatientInfoCard';
import { PredictionCard } from '../../components/analysis/PredictionCard';
import { CXRViewer } from '../../components/cxr/CXRViewer';
import { PageHeader } from '../../components/layout/AppLayout';
import { AiDisclaimerBanner, MockOutputWarning } from '../../components/safety/Disclaimers';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { CardSkeleton, ErrorState, Skeleton } from '../../components/ui/States';
import { formatDateTime } from '../../lib/utils';

function ResultsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Skeleton className="h-96 w-full rounded-xl" />
        <CardSkeleton />
      </div>
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function ResultsPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.analysis(analysisId ?? ''),
    queryFn: () => analysesApi.get(analysisId as string),
    enabled: Boolean(analysisId),
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Analysis result" />
        <ResultsSkeleton />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Analysis result" />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const { analysis } = data;
  const patient = analysis.patient;

  return (
    <>
      <PageHeader
        title="Analysis result"
        description={`Analyzed ${formatDateTime(analysis.createdAt)}`}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              leftIcon={<ArrowLeft className="size-4" aria-hidden />}
            >
              Back
            </Button>
            <Link to={`/analysis/${analysis.id}/report`}>
              <Button variant="secondary" leftIcon={<FileText className="size-4" aria-hidden />}>
                View report
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-6 space-y-4">
        <MockOutputWarning source={analysis.source} />
        <AiDisclaimerBanner />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Chest X-ray"
              description="Switch layers to inspect where the model focused."
              actions={<StatusBadge status={analysis.status} />}
            />
            <CardBody>
              <CXRViewer
                imageUrl={analysis.image.display ?? analysis.image.thumbnail}
                heatmapUrl={analysis.image.heatmap}
                alt={
                  patient
                    ? `Chest X-ray for patient ${patient.medicalRecordNumber}`
                    : 'Chest X-ray'
                }
              />
            </CardBody>
          </Card>

          {patient ? <PatientInfoCard patient={patient} analysis={analysis} /> : null}

          <DoctorReviewPanel analysis={analysis} />
        </div>

        <div className="space-y-6">
          <PredictionCard analysis={analysis} />
          <FindingsCard analysis={analysis} />
        </div>
      </div>
    </>
  );
}
