import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Cpu, Database, ShieldCheck, XCircle } from 'lucide-react';

import { queryKeys, systemApi } from '../../api/resources';
import { useAuth } from '../../app/AuthContext';
import { PageHeader } from '../../components/layout/AppLayout';
import { AiDisclaimerBanner } from '../../components/safety/Disclaimers';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { CardSkeleton, ErrorState } from '../../components/ui/States';
import { cn, formatBytes, formatDateTime, formatPercent } from '../../lib/utils';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function SettingsPage() {
  const { doctor } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.modelInfo,
    queryFn: systemApi.modelInfo,
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account details, AI model status, and data retention configuration."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" icon={<ShieldCheck className="size-5" aria-hidden />} />
          <CardBody>
            {doctor ? (
              <dl>
                <Row label="Name" value={doctor.fullName} />
                <Row label="Email" value={doctor.email} />
                <Row label="Specialty" value={doctor.specialty ?? '—'} />
                <Row label="License ID" value={doctor.licenseId ?? '—'} />
                <Row
                  label="Role"
                  value={<Badge tone="info">{doctor.role === 'ADMIN' ? 'Administrator' : 'Clinician'}</Badge>}
                />
                <Row label="Last sign-in" value={formatDateTime(doctor.lastLoginAt)} />
              </dl>
            ) : null}
          </CardBody>
        </Card>

        {isLoading ? (
          <CardSkeleton />
        ) : error ? (
          <Card>
            <ErrorState error={error} onRetry={() => void refetch()} />
          </Card>
        ) : data ? (
          <>
            {(data.models ?? []).map((model) => {
              const ready = model.available && model.modelLoaded;
              return (
                <Card key={model.id} className="lg:col-span-2">
                  <CardHeader
                    title={model.name}
                    description={model.description}
                    icon={<Cpu className="size-5" aria-hidden />}
                    actions={
                      data.ai.source === 'mock' ? (
                        <Badge tone="warning">Mock provider</Badge>
                      ) : ready ? (
                        <Badge tone="success" icon={<CheckCircle2 className="size-3" aria-hidden />}>
                          Ready
                        </Badge>
                      ) : (
                        <Badge tone="danger" icon={<XCircle className="size-3" aria-hidden />}>
                          Unavailable
                        </Badge>
                      )
                    }
                  />
                  <CardBody className="space-y-4">
                    {!ready && data.ai.source !== 'mock' ? (
                      <Alert tone="danger" title="Model not loaded">
                        {model.error ??
                          'This inference service is not serving predictions. Analyses that select it will fail until it is available.'}
                      </Alert>
                    ) : null}

                    <dl>
                      <Row label="Service reachable" value={model.available ? 'Yes' : 'No'} />
                      <Row label="Model loaded" value={model.modelLoaded ? 'Yes' : 'No'} />
                      <Row
                        label="Model version"
                        value={
                          <span className="break-all font-mono text-xs">
                            {model.modelVersion ?? '—'}
                          </span>
                        }
                      />
                      <Row label="Compute device" value={model.device ?? '—'} />
                      <Row label="Grad-CAM" value={data.gradcamEnabled ? 'Enabled' : 'Disabled'} />
                    </dl>

                    {model.evaluation.perClass.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                              <th scope="col" className="py-2 pr-4 font-medium">
                                Class
                              </th>
                              <th scope="col" className="px-3 py-2 text-right font-medium">
                                Precision
                              </th>
                              <th scope="col" className="px-3 py-2 text-right font-medium">
                                Recall
                              </th>
                              <th scope="col" className="px-3 py-2 text-right font-medium">
                                F1
                              </th>
                              <th scope="col" className="px-3 py-2 text-right font-medium">
                                AUC
                              </th>
                              <th scope="col" className="py-2 pl-3 text-right font-medium">
                                Support
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {model.evaluation.perClass.map((row) => (
                              <tr key={row.label}>
                                <td className="py-2 pr-4 text-slate-900">{row.label}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                  {row.precision.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                  {row.recall.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                  {row.f1.toFixed(2)}
                                </td>
                                <td
                                  className={cn(
                                    'px-3 py-2 text-right tabular-nums',
                                    row.auc >= 0.97 ? 'text-emerald-700' : 'text-slate-700',
                                  )}
                                >
                                  {row.auc.toFixed(4)}
                                </td>
                                <td className="py-2 pl-3 text-right tabular-nums text-slate-500">
                                  {row.support}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {model.evaluation.accuracy != null ? (
                          <p className="mt-3 text-sm text-slate-600">
                            Test accuracy {formatPercent(model.evaluation.accuracy, 1)}
                            {model.evaluation.sampleCount
                              ? ` on ${model.evaluation.sampleCount} images.`
                              : '.'}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <Alert tone="info">{model.evaluation.caveat}</Alert>
                  </CardBody>
                </Card>
              );
            })}

            <Card className="lg:col-span-2">
              <CardHeader
                title="Data retention"
                description="Configured on the backend. Contact your administrator to change these."
                icon={<Database className="size-5" aria-hidden />}
              />
              <CardBody>
                <dl>
                  <Row
                    label="Store full-resolution X-rays"
                    value={
                      data.retention.storeOriginalImages ? (
                        <Badge tone="warning">Enabled</Badge>
                      ) : (
                        <Badge tone="success">Disabled</Badge>
                      )
                    }
                  />
                  <Row
                    label="Store thumbnails and heatmaps"
                    value={
                      data.retention.storeThumbnails ? (
                        <Badge tone="info">Enabled</Badge>
                      ) : (
                        <Badge tone="neutral">Disabled</Badge>
                      )
                    }
                  />
                  <Row label="Thumbnail size" value={`${data.retention.thumbnailSize} px`} />
                  <Row
                    label="Maximum upload size"
                    value={formatBytes(data.retention.maxUploadBytes)}
                  />
                  <Row
                    label="Risk banding thresholds"
                    value={
                      <span className="tabular-nums">
                        high ≥ {formatPercent(data.riskThresholds.highConfidence, 0)}, low &lt;{' '}
                        {formatPercent(data.riskThresholds.lowConfidence, 0)}
                      </span>
                    }
                  />
                </dl>

                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  When full-resolution storage is disabled, uploaded X-rays are held in memory
                  for the duration of the analysis request only. A SHA-256 checksum of every
                  upload is retained so a result can always be traced to the exact image that
                  produced it.
                </p>
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>

      <div className="mt-6">
        <AiDisclaimerBanner />
      </div>
    </>
  );
}
