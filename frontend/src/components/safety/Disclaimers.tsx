/**
 * Medical safety messaging.
 *
 * Centralized so the wording is identical everywhere it appears - on screen, in the
 * printed report, and in the exported PDF - and cannot drift out of sync.
 */
import { FlaskConical, Info } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { InferenceSource } from '../../types/api';
import { Alert } from '../ui/Alert';

export const AI_DISCLAIMER =
  'AI-generated results are intended to support clinical decision-making and should be ' +
  'reviewed and interpreted by a qualified healthcare professional. This output is not a ' +
  'definitive medical diagnosis.';

export const RESPONSIBILITY_NOTE =
  'The treating clinician remains responsible for the final clinical assessment.';

export const DEMO_NOTICE =
  'Demonstration system — not for clinical use. Do not upload real patient images or ' +
  'protected health information.';

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

/** Persistent notice for hosted demos that must not receive real PHI. */
export function DemoBanner({ className }: { className?: string }) {
  if (!isDemoMode) return null;

  return (
    <Alert
      tone="warning"
      title="Demonstration only — not for clinical use"
      className={className}
    >
      <p>{DEMO_NOTICE}</p>
    </Alert>
  );
}

/** Prominent banner for results and report pages. */
export function AiDisclaimerBanner({ className }: { className?: string }) {
  return (
    <Alert tone="info" title="Clinical decision support" className={className}>
      <p>
        {AI_DISCLAIMER} {RESPONSIBILITY_NOTE}
      </p>
    </Alert>
  );
}

/** Compact inline variant for dense layouts and print output. */
export function AiDisclaimerNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex gap-2 text-xs leading-relaxed text-slate-500', className)}>
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {AI_DISCLAIMER} {RESPONSIBILITY_NOTE}
      </span>
    </p>
  );
}

/**
 * Shown whenever a result came from the development stub. Deliberately loud: this is the
 * last line of defence against synthetic output being read as a real prediction.
 */
export function MockOutputWarning({
  source,
  className,
}: {
  source: InferenceSource;
  className?: string;
}) {
  if (source !== 'mock') return null;

  return (
    <Alert
      tone="warning"
      title="Simulated result — not a real model prediction"
      className={cn('mock-hatch', className)}
      icon={<FlaskConical className="size-5" aria-hidden />}
    >
      <p>
        The backend is running with <code className="font-mono text-xs">AI_PROVIDER=mock</code>, a
        development stub that does not analyze the image. These numbers are placeholders for
        interface development and carry no clinical meaning whatsoever. Connect the trained model
        before using this system with patients.
      </p>
    </Alert>
  );
}
