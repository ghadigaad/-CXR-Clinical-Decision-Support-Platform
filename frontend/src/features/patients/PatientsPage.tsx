import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { patientsApi, queryKeys, type PatientFilters } from '../../api/resources';
import { PageHeader } from '../../components/layout/AppLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardFooter } from '../../components/ui/Card';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/ui/States';
import { formatGender, formatPercent, formatRelativeTime } from '../../lib/utils';
import { PatientForm } from './PatientForm';

export function PatientsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo<PatientFilters>(
    () => ({ search: debouncedSearch.trim() || undefined, page, pageSize: 20 }),
    [debouncedSearch, page],
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.patients(filters),
    queryFn: () => patientsApi.list(filters),
  });

  const patients = data?.patients ?? [];
  const pagination = data?.pagination;

  if (isCreating) {
    return (
      <>
        <PageHeader
          title="New patient"
          description="Create a patient record. You can run an analysis immediately afterwards."
          actions={
            <Button variant="ghost" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          }
        />
        <PatientForm
          onSaved={(patient) => navigate(`/patients/${patient.id}`)}
          submitLabel="Create patient"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="Patient records you have created and their analysis history."
        actions={
          <Button
            onClick={() => setIsCreating(true)}
            leftIcon={<UserPlus className="size-4" aria-hidden />}
          >
            New patient
          </Button>
        }
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
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or patient ID…"
              aria-label="Search patients"
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
            />
          </div>
          {searchInput ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchInput('')}
              leftIcon={<X className="size-4" aria-hidden />}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title={debouncedSearch ? 'No matching patients' : 'No patients yet'}
            description={
              debouncedSearch
                ? `No patient matches “${debouncedSearch}”.`
                : 'Create your first patient record to begin analyzing chest X-rays.'
            }
            action={
              debouncedSearch ? (
                <Button variant="secondary" onClick={() => setSearchInput('')}>
                  Clear search
                </Button>
              ) : (
                <Button
                  onClick={() => setIsCreating(true)}
                  leftIcon={<Plus className="size-4" aria-hidden />}
                >
                  New patient
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <li key={patient.id}>
                <Link
                  to={`/patients/${patient.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{patient.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="font-mono">{patient.medicalRecordNumber}</span>
                      {' · '}
                      {patient.age} years · {formatGender(patient.gender)}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    {patient.latestAnalysis ? (
                      <>
                        <p className="text-sm text-slate-800">
                          {patient.latestAnalysis.label}{' '}
                          <span className="tabular-nums text-slate-500">
                            · {formatPercent(patient.latestAnalysis.confidence)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatRelativeTime(patient.latestAnalysis.createdAt)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">No analyses</p>
                    )}
                  </div>

                  <Badge tone="neutral" className="shrink-0">
                    {patient.analysisCount}{' '}
                    {patient.analysisCount === 1 ? 'study' : 'studies'}
                  </Badge>

                  <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <CardFooter className="justify-between">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} patients
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </Card>
    </>
  );
}
