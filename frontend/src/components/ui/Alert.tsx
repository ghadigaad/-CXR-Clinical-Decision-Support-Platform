import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { container: string; icon: string; Icon: typeof Info }> = {
  info: {
    container: 'border-clinical-200 bg-clinical-50 text-clinical-900',
    icon: 'text-clinical-600',
    Icon: Info,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'border-amber-300 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    Icon: AlertTriangle,
  },
  danger: {
    container: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
    Icon: ShieldAlert,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  icon,
  actions,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  const config = TONES[tone];
  const Icon = config.Icon;

  return (
    <div
      className={cn('rounded-lg border px-4 py-3', config.container, className)}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      <div className="flex gap-3">
        <div className={cn('mt-0.5 shrink-0', config.icon)}>
          {icon ?? <Icon className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          {children ? (
            <div className={cn('text-sm', title && 'mt-1', 'opacity-90')}>{children}</div>
          ) : null}
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
