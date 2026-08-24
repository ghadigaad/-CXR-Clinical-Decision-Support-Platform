import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AiDisclaimerNote } from '../../components/safety/Disclaimers';
import { Card, CardBody } from '../../components/ui/Card';
import { cn } from '../../lib/utils';

/**
 * Staged progress display.
 *
 * The stages are descriptive rather than measured - the inference service does not
 * stream progress - so the copy avoids implying a precise percentage. It exists to make
 * a multi-second wait legible and to reassure the clinician that work is happening.
 */
const STAGES = [
  { label: 'Uploading image', durationMs: 900 },
  { label: 'Validating and preparing the study', durationMs: 800 },
  { label: 'Running the model', durationMs: 2600 },
  { label: 'Generating findings and report', durationMs: 1200 },
] as const;

export function AnalysisProgress({
  patientName,
  previewUrl,
}: {
  patientName: string;
  previewUrl: string | null;
}) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) return;

    const timer = setTimeout(
      () => setStageIndex((index) => Math.min(index + 1, STAGES.length - 1)),
      STAGES[stageIndex]?.durationMs ?? 1000,
    );
    return () => clearTimeout(timer);
  }, [stageIndex]);

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardBody className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex size-14 items-center justify-center rounded-full bg-clinical-50">
              <Loader2 className="size-7 animate-spin text-clinical-600" aria-hidden />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">Analyzing chest X-ray</h2>
            <p className="mt-1 text-sm text-slate-500">
              {patientName ? `Patient: ${patientName}. ` : ''}This usually takes a few seconds.
            </p>
          </div>

          {previewUrl ? (
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
              <img
                src={previewUrl}
                alt=""
                className="mx-auto max-h-56 w-auto object-contain opacity-80"
              />
            </div>
          ) : null}

          <ol
            className="mt-6 space-y-3"
            aria-live="polite"
            aria-label="Analysis progress"
          >
            {STAGES.map((stage, index) => {
              const isDone = index < stageIndex;
              const isActive = index === stageIndex;

              return (
                <li key={stage.label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full',
                      isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : isActive
                          ? 'bg-clinical-100 text-clinical-700'
                          : 'bg-slate-100 text-slate-400',
                    )}
                    aria-hidden
                  >
                    {isDone ? (
                      <Check className="size-3.5" />
                    ) : isActive ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-sm',
                      isDone
                        ? 'text-slate-500'
                        : isActive
                          ? 'font-medium text-slate-900'
                          : 'text-slate-400',
                    )}
                  >
                    {stage.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <AiDisclaimerNote />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
