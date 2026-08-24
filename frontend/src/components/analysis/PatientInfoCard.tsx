import { Link } from 'react-router-dom';

import { formatDate, formatDateTime, formatGender } from '../../lib/utils';
import type { Analysis, Patient } from '../../types/api';
import { ClinicianBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function LongDetail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{value}</dd>
    </div>
  );
}

/**
 * Clinician-entered context.
 *
 * Styled in neutral slate with a "Entered by clinician" marker, in deliberate contrast
 * to the violet AI cards, so the two information sources are never confused.
 */
export function PatientInfoCard({
  patient,
  analysis,
  linkToPatient = true,
}: {
  patient: Patient;
  analysis?: Analysis;
  linkToPatient?: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Patient and clinical information"
        description="Entered by the clinician; not used to generate the prediction."
        actions={<ClinicianBadge />}
      />

      <CardBody className="space-y-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail
            label="Name"
            value={
              linkToPatient ? (
                <Link
                  to={`/patients/${patient.id}`}
                  className="font-medium text-clinical-700 hover:underline"
                >
                  {patient.fullName}
                </Link>
              ) : (
                <span className="font-medium">{patient.fullName}</span>
              )
            }
          />
          <Detail
            label="Patient ID"
            value={<span className="font-mono">{patient.medicalRecordNumber}</span>}
          />
          <Detail label="Age" value={`${patient.age} years`} />
          <Detail label="Gender" value={formatGender(patient.gender)} />
          <Detail label="Date of birth" value={formatDate(patient.dateOfBirth)} />
          {analysis ? (
            <Detail label="Analysis date" value={formatDateTime(analysis.createdAt)} />
          ) : null}
        </dl>

        {patient.clinicalHistory || patient.symptoms || patient.notes ? (
          <dl className="space-y-4 border-t border-slate-100 pt-4">
            <LongDetail label="Clinical history" value={patient.clinicalHistory} />
            <LongDetail label="Presenting symptoms" value={patient.symptoms} />
            <LongDetail label="Additional notes" value={patient.notes} />
          </dl>
        ) : null}
      </CardBody>
    </Card>
  );
}
