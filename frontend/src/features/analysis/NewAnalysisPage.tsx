import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ScanLine, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { analysesApi, patientsApi, queryKeys, systemApi, type ModelId } from '../../api/resources';
import { PageHeader } from '../../components/layout/AppLayout';
import { CXRUploader, type SelectedImage } from '../../components/cxr/CXRUploader';
import { AiDisclaimerBanner } from '../../components/safety/Disclaimers';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { cn, formatGender } from '../../lib/utils';
import type { Patient } from '../../types/api';
import { PatientForm } from '../patients/PatientForm';
import { AnalysisProgress } from './AnalysisProgress';
import { ModelPicker } from './ModelPicker';

type Step = 'patient' | 'upload';

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: 'patient', label: 'Patient information', description: 'Identify and describe the case' },
  { id: 'upload', label: 'Chest X-ray', description: 'Upload the image and run analysis' },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset',
                isComplete
                  ? 'bg-clinical-600 text-white ring-clinical-600'
                  : isCurrent
                    ? 'bg-clinical-50 text-clinical-700 ring-clinical-300'
                    : 'bg-white text-slate-400 ring-slate-200',
              )}
              aria-hidden
            >
              {isComplete ? <Check className="size-4" /> : index + 1}
            </span>
            <span>
              <span
                className={cn(
                  'block text-sm font-medium',
                  isCurrent ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                {step.label}
              </span>
              <span className="block text-xs text-slate-400">{step.description}</span>
            </span>
            {index < STEPS.length - 1 ? (
              <span className="hidden h-px w-8 bg-slate-200 sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Compact recap of the saved patient, shown while the clinician works on step 2. */
function PatientSummary({ patient, onChange }: { patient: Patient; onChange: () => void }) {
  return (
    <Card>
      <CardHeader
        title="Patient"
        description="Saved and attached to this analysis."
        actions={
          <Button variant="ghost" size="sm" onClick={onChange}>
            Change
          </Button>
        }
      />
      <CardBody>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{patient.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Patient ID
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-slate-900">
              {patient.medicalRecordNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Age</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{patient.age}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Gender</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{formatGender(patient.gender)}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

/** Lets the clinician attach the study to a patient they already recorded. */
function ExistingPatientPicker({ onSelect }: { onSelect: (patient: Patient) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await patientsApi.list({ search: query.trim(), pageSize: 5 });
        if (!controller.signal.aborted) setResults(response.patients);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Card>
      <CardHeader
        title="Use an existing patient"
        description="Search by name or patient ID to attach this study to an existing record."
      />
      <CardBody className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patients…"
            aria-label="Search existing patients"
            className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
          />
        </div>

        {isSearching ? (
          <p className="text-sm text-slate-500">Searching…</p>
        ) : results && results.length === 0 ? (
          <p className="text-sm text-slate-500">
            No patients match “{query}”. Create a new record below.
          </p>
        ) : results ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => onSelect(patient)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {patient.fullName}
                    </span>
                    <span className="block font-mono text-xs text-slate-500">
                      {patient.medicalRecordNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {patient.age} · {formatGender(patient.gender)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function NewAnalysisPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [step, setStep] = useState<Step>('patient');
  const [modelId, setModelId] = useState<ModelId>('densenet-cbam');

  const { data: modelInfo } = useQuery({
    queryKey: queryKeys.modelInfo,
    queryFn: systemApi.modelInfo,
    refetchInterval: 30_000,
  });

  const models = modelInfo?.models ?? [];
  const selectedModel = models.find((model) => model.id === modelId);
  const selectedReady =
    models.length === 0 || Boolean(selectedModel?.available && selectedModel.modelLoaded);

  /**
   * Stable idempotency key for this attempt. The backend uses it to collapse duplicate
   * submissions, so a retry after a network wobble cannot bill a second inference run
   * or create a second record.
   */
  const requestIdRef = useRef<string>(crypto.randomUUID());

  // Deep link from a patient page: /analysis/new?patientId=...
  const presetPatientId = searchParams.get('patientId');
  const [isLoadingPreset, setIsLoadingPreset] = useState(Boolean(presetPatientId));

  useEffect(() => {
    if (!presetPatientId) return;
    let cancelled = false;

    patientsApi
      .get(presetPatientId)
      .then((response) => {
        if (cancelled) return;
        setPatient(response.patient);
        setStep('upload');
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoadingPreset(false);
      });

    return () => {
      cancelled = true;
    };
  }, [presetPatientId]);

  const analyzeMutation = useMutation({
    mutationFn: () => {
      if (!patient || !image) throw new Error('Patient and image are required.');
      return analysesApi.analyze({
        patientId: patient.id,
        image: image.file,
        requestId: requestIdRef.current,
        modelId,
      });
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['analyses'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.setQueryData(queryKeys.analysis(response.analysis.id), {
        analysis: response.analysis,
        disclaimer: response.disclaimer,
      });

      if (response.duplicate) {
        toast.notify({
          tone: 'info',
          title: 'Existing result opened',
          description: 'This image was already analyzed for this patient.',
        });
      } else {
        toast.success('Analysis complete', 'Review the result before finalizing the report.');
      }

      navigate(`/analysis/${response.analysis.id}`, { replace: true });
    },
    onError: () => {
      // A failed attempt releases its key on the server, so a fresh one is needed to
      // avoid colliding with the released claim.
      requestIdRef.current = crypto.randomUUID();
    },
  });

  if (isLoadingPreset) {
    return <LoadingState label="Loading patient" />;
  }

  if (analyzeMutation.isPending) {
    return (
      <AnalysisProgress
        patientName={patient?.fullName ?? ''}
        previewUrl={image?.previewUrl ?? null}
      />
    );
  }

  const error = analyzeMutation.error;
  const apiError = error instanceof ApiError ? error : null;

  return (
    <>
      <PageHeader
        title="New analysis"
        description="Record the patient, upload the chest X-ray, and run AI-assisted analysis."
        actions={
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="size-4" aria-hidden />}
          >
            Back
          </Button>
        }
      />

      <StepIndicator current={step} />

      <div className="space-y-6">
        {step === 'patient' ? (
          <>
            <ExistingPatientPicker
              onSelect={(selected) => {
                setPatient(selected);
                setStep('upload');
              }}
            />
            <PatientForm
              onSaved={(saved) => {
                setPatient(saved);
                setStep('upload');
              }}
              submitLabel="Save and continue"
              description="Saved before analysis so the record exists even if inference fails."
            />
          </>
        ) : patient ? (
          <>
            <PatientSummary patient={patient} onChange={() => setStep('patient')} />

            <Card>
              <CardHeader
                title="Chest X-ray"
                description="Frontal chest radiograph. The image is transmitted for analysis and is not stored at full resolution unless your deployment enables it."
              />
              <CardBody className="space-y-6">
                <CXRUploader value={image} onChange={setImage} />
                {models.length > 0 ? (
                  <ModelPicker models={models} value={modelId} onChange={setModelId} />
                ) : null}
              </CardBody>

              <CardFooter className="justify-between">
                <p className="text-xs text-slate-500">
                  {image
                    ? selectedReady
                      ? `Ready to analyze with ${selectedModel?.shortName ?? 'the selected model'}.`
                      : 'The selected model is offline. Choose another, or wait until it is available.'
                    : 'Upload an image to enable analysis.'}
                </p>
                <Button
                  size="lg"
                  onClick={() => analyzeMutation.mutate()}
                  disabled={!image || !selectedReady}
                  isLoading={analyzeMutation.isPending}
                  leftIcon={<ScanLine className="size-5" aria-hidden />}
                >
                  Analyze CXR
                </Button>
              </CardFooter>
            </Card>

            {apiError ? (
              <Alert
                tone={apiError.code === 'AI_SERVICE_UNAVAILABLE' ? 'warning' : 'danger'}
                title={
                  apiError.code === 'AI_SERVICE_UNAVAILABLE'
                    ? 'The AI model is unavailable'
                    : 'Analysis failed'
                }
                actions={
                  <Button size="sm" variant="secondary" onClick={() => analyzeMutation.reset()}>
                    Dismiss
                  </Button>
                }
              >
                <p>{apiError.message}</p>
                {apiError.code === 'AI_SERVICE_UNAVAILABLE' ? (
                  <p className="mt-2">
                    No result was produced and nothing was saved. Confirm the inference
                    service is running with the model weights installed, then try again.
                  </p>
                ) : null}
              </Alert>
            ) : null}

            <AiDisclaimerBanner />
          </>
        ) : null}
      </div>
    </>
  );
}
