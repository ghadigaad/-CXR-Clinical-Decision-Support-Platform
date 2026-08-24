import { useQuery } from '@tanstack/react-query';
import { FileText, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { analysesApi, queryKeys, type AnalysisFilters } from '../../api/resources';
import { AnalysisTable } from '../../components/analysis/AnalysisTable';
import { PageHeader } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Card, CardFooter } from '../../components/ui/Card';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/ui/States';
import type { AnalysisStatus, RiskLevel } from '../../types/api';

const STATUS_OPTIONS: { value: AnalysisStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'FINALIZED', label: 'Finalized' },
];

const PREDICTION_OPTIONS = [
  { value: '', label: 'All predictions' },
  { value: 'Normal', label: 'Normal' },
  { value: 'Bacterial Pneumonia', label: 'Bacterial Pneumonia' },
  { value: 'Viral Pneumonia', label: 'Viral Pneumonia' },
];

const RISK_OPTIONS: { value: RiskLevel | ''; label: string }[] = [
  { value: '', label: 'All risk levels' },
  { value: 'LOW', label: 'Low risk' },
  { value: 'MODERATE', label: 'Moderate risk' },
  { value: 'HIGH', label: 'High risk' },
];

const SELECT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20';

export function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters live in the URL so a filtered view can be bookmarked and shared. Only
  // non-identifying filter values are stored there - never a patient id.
  const status = (searchParams.get('status') as AnalysisStatus | null) ?? '';
  const prediction = searchParams.get('prediction') ?? '';
  const riskLevel = (searchParams.get('riskLevel') as RiskLevel | null) ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    // Any filter change invalidates the current page offset.
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  }

  const filters = useMemo<AnalysisFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: (status || undefined) as AnalysisStatus | undefined,
      prediction: prediction || undefined,
      riskLevel: (riskLevel || undefined) as RiskLevel | undefined,
      page,
      pageSize: 20,
    }),
    [debouncedSearch, status, prediction, riskLevel, page],
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.analyses(filters),
    queryFn: () => analysesApi.list(filters),
  });

  const analyses = data?.analyses ?? [];
  const pagination = data?.pagination;
  const hasFilters = Boolean(debouncedSearch || status || prediction || riskLevel);

  function clearFilters() {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="All chest X-ray analyses and their report status."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                updateParam('search', event.target.value);
              }}
              placeholder="Search by patient name or ID…"
              aria-label="Search analyses"
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
            />
          </div>

          <select
            value={status}
            onChange={(event) => updateParam('status', event.target.value)}
            aria-label="Filter by status"
            className={SELECT_CLASS}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={prediction}
            onChange={(event) => updateParam('prediction', event.target.value)}
            aria-label="Filter by prediction"
            className={SELECT_CLASS}
          >
            {PREDICTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={riskLevel}
            onChange={(event) => updateParam('riskLevel', event.target.value)}
            aria-label="Filter by risk level"
            className={SELECT_CLASS}
          >
            {RISK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              leftIcon={<X className="size-4" aria-hidden />}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : analyses.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title={hasFilters ? 'No matching analyses' : 'No reports yet'}
            description={
              hasFilters
                ? 'Try adjusting your search or filters.'
                : 'Reports appear here after you analyze a chest X-ray.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => navigate('/analysis/new')}>Start a new analysis</Button>
              )
            }
          />
        ) : (
          <div aria-busy={isFetching}>
            <AnalysisTable analyses={analyses} />
          </div>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <CardFooter className="justify-between">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => updateParam('page', String(pagination.page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateParam('page', String(pagination.page + 1))}
              >
                Next
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </Card>

      {!isLoading && analyses.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Showing {analyses.length} of {pagination?.total ?? analyses.length} analyses.
        </p>
      ) : null}
    </>
  );
}
