import { Clock, Cpu, Info } from 'lucide-react';

import { cn, formatModelName, formatPercent } from '../../lib/utils';
import type { Analysis } from '../../types/api';
import { AiBadge, RiskBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';

/** Horizontal probability bar. Values are the model's own softmax outputs. */
function ProbabilityBar({
  label,
  probability,
  isTop,
}: {
  label: string;
  probability: number;
  isTop: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'text-sm',
            isTop ? 'font-semibold text-slate-900' : 'text-slate-600',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'text-sm tabular-nums',
            isTop ? 'font-semibold text-slate-900' : 'text-slate-500',
          )}
        >
          {formatPercent(probability)}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-valuenow={Math.round(probability * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} probability`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            isTop ? 'bg-ai-500' : 'bg-slate-300',
          )}
          style={{ width: `${Math.max(probability * 100, 1)}%` }}
        />
      </div>
    </div>
  );
}

export function PredictionCard({ analysis }: { analysis: Analysis }) {
  const ranked = [...analysis.prediction.probabilities].sort(
    (a, b) => b.probability - a.probability,
  );

  return (
    <Card className="border-ai-200">
      <CardHeader
        title="AI prediction"
        description={`Produced by ${formatModelName(analysis.modelName ?? analysis.modelVersion)} from the uploaded image alone.`}
        actions={<AiBadge />}
        className="bg-ai-50/40"
      />

      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Primary prediction
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {analysis.prediction.label}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Confidence
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ai-700">
              {formatPercent(analysis.prediction.confidence)}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Class probabilities
          </p>
          {ranked.map((item, index) => (
            <ProbabilityBar
              key={item.label}
              label={item.label}
              probability={item.probability}
              isTop={index === 0}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Risk level
            </span>
            <RiskBadge risk={analysis.riskLevel} />
          </div>

          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {/* The classifier emits class probabilities only; risk is banding applied by
                this system, and saying so prevents it being read as a model output. */}
            Risk level is derived by this system from the model’s confidence, not returned
            by the model.
          </p>
        </div>

        <dl className="grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Cpu className="size-3.5 text-slate-400" aria-hidden />
            <dt className="text-slate-500">Model:</dt>
            <dd className="truncate text-slate-700">
              {formatModelName(analysis.modelName ?? analysis.modelVersion)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-slate-400" aria-hidden />
            <dt className="text-slate-500">Processing time:</dt>
            <dd className="tabular-nums text-slate-700">{analysis.processingTimeMs} ms</dd>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <dt className="text-slate-500">Version:</dt>
            <dd className="truncate font-mono text-slate-700">{analysis.modelVersion}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
