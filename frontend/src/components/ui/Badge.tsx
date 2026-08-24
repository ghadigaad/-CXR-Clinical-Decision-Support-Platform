import { Sparkles, Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn, formatRiskLevel, formatStatus } from '../../lib/utils';
import type { AnalysisStatus, RiskLevel } from '../../types/api';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'ai';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-clinical-50 text-clinical-700 ring-clinical-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  ai: 'bg-ai-50 text-ai-700 ring-ai-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: 'success',
  MODERATE: 'warning',
  HIGH: 'danger',
};

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  return (
    <Badge tone={RISK_TONE[risk]} className={className}>
      {formatRiskLevel(risk)} risk
    </Badge>
  );
}

const STATUS_TONE: Record<AnalysisStatus, Tone> = {
  PENDING_REVIEW: 'warning',
  REVIEWED: 'info',
  FINALIZED: 'success',
};

export function StatusBadge({
  status,
  className,
}: {
  status: AnalysisStatus;
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {formatStatus(status)}
    </Badge>
  );
}

/**
 * Marks a value as model output. Paired with {@link ClinicianBadge}, this is the primary
 * mechanism keeping AI-generated content visually separable from what a clinician wrote.
 */
export function AiBadge({ className, label = 'AI generated' }: { className?: string; label?: string }) {
  return (
    <Badge tone="ai" className={className} icon={<Sparkles className="size-3" aria-hidden />}>
      {label}
    </Badge>
  );
}

export function ClinicianBadge({ className, label = 'Entered by clinician' }: { className?: string; label?: string }) {
  return (
    <Badge tone="neutral" className={className} icon={<Stethoscope className="size-3" aria-hidden />}>
      {label}
    </Badge>
  );
}
