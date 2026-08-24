import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Plus,
  ScanLine,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { analysesApi, queryKeys } from '../../api/resources';
import { AnalysisTable } from '../../components/analysis/AnalysisTable';
import { PageHeader } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/ui/States';
import { cn, formatPercent } from '../../lib/utils';
import { useAuth } from '../../app/AuthContext';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  hint?: string;
  icon: typeof Users;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold tabular-nums',
              tone === 'warning' && value > 0 ? 'text-amber-600' : 'text-slate-900',
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
        </div>
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            tone === 'warning' && value > 0
              ? 'bg-amber-50 text-amber-600'
              : 'bg-clinical-50 text-clinical-600',
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </div>
      </CardBody>
    </Card>
  );
}

function PredictionBreakdown({
  breakdown,
  total,
}: {
  breakdown: { label: string; count: number }[];
  total: number;
}) {
  if (breakdown.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Prediction distribution"
        description="Across all analyses you have run."
      />
      <CardBody className="space-y-3">
        {breakdown.map((item) => {
          const share = total > 0 ? item.count / total : 0;
          return (
            <div key={item.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-slate-700">{item.label}</span>
                <span className="text-sm tabular-nums text-slate-500">
                  {item.count} · {formatPercent(share, 0)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-clinical-500"
                  style={{ width: `${Math.max(share * 100, 1)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { doctor } = useAuth();

  const statsQuery = useQuery({ queryKey: queryKeys.stats, queryFn: analysesApi.stats });

  const recentFilters = { pageSize: 8 };
  const recentQuery = useQuery({
    queryKey: queryKeys.analyses(recentFilters),
    queryFn: () => analysesApi.list(recentFilters),
  });

  const stats = statsQuery.data?.stats;
  const recent = recentQuery.data?.analyses ?? [];

  return (
    <>
      <PageHeader
        title={doctor ? `Welcome back, ${doctor.fullName.split(' ').slice(-1)[0]}` : 'Dashboard'}
        description="Overview of your chest X-ray analyses and pending reviews."
        actions={
          <Button
            onClick={() => navigate('/analysis/new')}
            leftIcon={<Plus className="size-4" aria-hidden />}
          >
            New analysis
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
        ) : stats ? (
          <>
            <StatCard
              label="Patients analyzed"
              value={stats.patientCount}
              icon={Users}
              hint="Total patients in your records"
            />
            <StatCard
              label="Total analyses"
              value={stats.totalAnalyses}
              icon={ScanLine}
              hint={`${stats.analysesThisWeek} in the last 7 days`}
            />
            <StatCard
              label="Pending review"
              value={stats.pendingReview}
              icon={ClipboardList}
              tone="warning"
              hint="Awaiting your assessment"
            />
            <StatCard
              label="Finalized reports"
              value={stats.finalized}
              icon={CheckCircle2}
              hint="Reviewed and signed"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent analyses"
              description="Your most recent chest X-ray studies."
              actions={
                recent.length > 0 ? (
                  <Link
                    to="/reports"
                    className="text-sm font-medium text-clinical-700 hover:underline"
                  >
                    View all
                  </Link>
                ) : null
              }
            />

            {recentQuery.isLoading ? (
              <TableSkeleton rows={5} />
            ) : recentQuery.error ? (
              <ErrorState error={recentQuery.error} onRetry={() => void recentQuery.refetch()} />
            ) : recent.length === 0 ? (
              <EmptyState
                icon={<Activity className="size-6" aria-hidden />}
                title="No analyses yet"
                description="Record a patient and upload a chest X-ray to run your first AI-assisted analysis."
                action={
                  <Button
                    onClick={() => navigate('/analysis/new')}
                    leftIcon={<Plus className="size-4" aria-hidden />}
                  >
                    Start a new analysis
                  </Button>
                }
              />
            ) : (
              <AnalysisTable analyses={recent} />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {stats && stats.totalAnalyses > 0 ? (
            <PredictionBreakdown
              breakdown={stats.predictionBreakdown}
              total={stats.totalAnalyses}
            />
          ) : null}

          <Card>
            <CardHeader title="Quick actions" />
            <CardBody className="space-y-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/analysis/new')}
                leftIcon={<ScanLine className="size-4" aria-hidden />}
              >
                New analysis
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/patients')}
                leftIcon={<Users className="size-4" aria-hidden />}
              >
                Browse patients
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/reports?status=PENDING_REVIEW')}
                leftIcon={<ClipboardList className="size-4" aria-hidden />}
              >
                Reports pending review
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
