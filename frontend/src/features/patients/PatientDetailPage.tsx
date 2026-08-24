import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { patientsApi, queryKeys } from '../../api/resources';
import { AnalysisTable } from '../../components/analysis/AnalysisTable';
import { PatientInfoCard } from '../../components/analysis/PatientInfoCard';
import { PageHeader } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/ui/States';
import { PatientForm } from './PatientForm';

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.patientAnalyses(patientId ?? ''),
    queryFn: () => patientsApi.analyses(patientId as string),
    enabled: Boolean(patientId),
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Patient" />
        <div className="space-y-6">
          <CardSkeleton />
          <Card>
            <TableSkeleton rows={4} />
          </Card>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Patient" />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const { patient, analyses } = data;

  if (isEditing) {
    return (
      <>
        <PageHeader
          title="Edit patient"
          description={patient.fullName}
          actions={
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          }
        />
        <PatientForm
          patient={patient}
          onSaved={() => {
            setIsEditing(false);
            void refetch();
          }}
          submitLabel="Save changes"
          description="Changes apply to future reports; already-finalized reports keep their recorded values."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={patient.fullName}
        description={`Patient ID ${patient.medicalRecordNumber}`}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => navigate('/patients')}
              leftIcon={<ArrowLeft className="size-4" aria-hidden />}
            >
              All patients
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsEditing(true)}
              leftIcon={<Pencil className="size-4" aria-hidden />}
            >
              Edit
            </Button>
            <Button
              onClick={() => navigate(`/analysis/new?patientId=${patient.id}`)}
              leftIcon={<ScanLine className="size-4" aria-hidden />}
            >
              New analysis
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <PatientInfoCard patient={patient} linkToPatient={false} />

        <Card>
          <CardHeader
            title="Analysis history"
            description={
              analyses.length === 1
                ? '1 previous study for this patient.'
                : `${analyses.length} studies for this patient.`
            }
          />

          {analyses.length === 0 ? (
            <EmptyState
              icon={<ScanLine className="size-6" aria-hidden />}
              title="No analyses for this patient"
              description="Upload a chest X-ray to run the first analysis for this record."
              action={
                <Button onClick={() => navigate(`/analysis/new?patientId=${patient.id}`)}>
                  New analysis
                </Button>
              }
            />
          ) : (
            <AnalysisTable analyses={analyses} showPatient={false} />
          )}
        </Card>
      </div>
    </>
  );
}
