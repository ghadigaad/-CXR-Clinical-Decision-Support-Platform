import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, Menu, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { queryKeys, systemApi } from '../../api/resources';
import { useAuth } from '../../app/AuthContext';
import { cn, initials } from '../../lib/utils';
import { Button } from '../ui/Button';

/** Compact live indicator for AI service availability. */
function AiStatusPill() {
  const { data } = useQuery({
    queryKey: queryKeys.modelInfo,
    queryFn: systemApi.modelInfo,
    // Cheap poll so an outage surfaces without the clinician having to reload.
    refetchInterval: 60_000,
    retry: false,
  });

  if (!data) return null;

  const { available, modelLoaded, source } = data.ai;
  const isMock = source === 'mock';
  const models = data.models ?? [];
  const readyCount = models.filter((model) => model.available && model.modelLoaded).length;
  const allReady = models.length > 0 && readyCount === models.length;
  const ready = available && modelLoaded;

  const tone = isMock
    ? 'bg-amber-50 text-amber-800 ring-amber-200'
    : allReady || (models.length === 0 && ready)
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : readyCount > 0
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-red-50 text-red-700 ring-red-200';

  const dot = isMock
    ? 'bg-amber-500'
    : allReady || (models.length === 0 && ready)
      ? 'bg-emerald-500'
      : readyCount > 0
        ? 'bg-amber-500'
        : 'bg-red-500';
  const label = isMock
    ? 'Mock mode'
    : allReady
      ? 'Models ready'
      : readyCount > 0
        ? `${readyCount} of ${models.length} models`
        : 'Model offline';

  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset sm:inline-flex',
        tone,
      )}
      title={data.ai.error ?? data.ai.modelVersion ?? label}
    >
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  );
}

function DoctorMenu() {
  const { doctor, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!doctor) return null;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-clinical-100 text-xs font-semibold text-clinical-700">
          {initials(doctor.fullName)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-slate-900">
            {doctor.fullName}
          </span>
          <span className="block text-xs leading-tight text-slate-500">
            {doctor.specialty ?? doctor.role.toLowerCase()}
          </span>
        </span>
        <ChevronDown className="size-4 text-slate-400" aria-hidden />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{doctor.fullName}</p>
            <p className="truncate text-xs text-slate-500">{doctor.email}</p>
          </div>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="size-4 text-slate-400" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 no-print">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="flex-1" />

      <AiStatusPill />

      <Button
        size="sm"
        onClick={() => navigate('/analysis/new')}
        leftIcon={<Plus className="size-4" aria-hidden />}
        className="hidden sm:inline-flex"
      >
        New Analysis
      </Button>

      <DoctorMenu />
    </header>
  );
}
