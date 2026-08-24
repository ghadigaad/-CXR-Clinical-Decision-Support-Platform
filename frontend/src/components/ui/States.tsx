/** Loading, empty, and error states shared across every page. */
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError } from '../../api/client';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Spinner } from './Spinner';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200', className)}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-4', columnIndex === 0 ? 'w-40' : 'w-24')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-40" />
    </div>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500"
      role="status"
    >
      <Spinner className="size-7 text-clinical-600" label={label} />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * Renders an error with wording matched to its cause, so a network blip, an expired
 * session, and a model outage do not all read as the same generic failure.
 */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const isNetwork = apiError?.code === 'NETWORK_ERROR';
  const isAiDown = apiError?.code === 'AI_SERVICE_UNAVAILABLE';

  const title = isNetwork
    ? 'Connection lost'
    : isAiDown
      ? 'AI service unavailable'
      : 'Something went wrong';

  const message =
    apiError?.message ??
    (error instanceof Error ? error.message : 'An unexpected error occurred.');

  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
      role="alert"
    >
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          isAiDown ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600',
        )}
      >
        {isNetwork ? (
          <WifiOff className="size-6" aria-hidden />
        ) : (
          <AlertTriangle className="size-6" aria-hidden />
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          leftIcon={<RefreshCw className="size-4" aria-hidden />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
