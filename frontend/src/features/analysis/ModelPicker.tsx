import { Cpu } from 'lucide-react';

import type { ModelId } from '../../api/resources';
import { cn } from '../../lib/utils';
import type { ModelStatus } from '../../types/api';

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelStatus[];
  value: ModelId;
  onChange: (id: ModelId) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-900">AI model</legend>
      <p className="mt-1 text-sm text-slate-500">
        Both classifiers distinguish Normal, Bacterial Pneumonia, and Viral Pneumonia. Choose one
        before running analysis; the result records which model produced it.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {models.map((model) => {
          const ready = model.available && model.modelLoaded;
          const selected = value === model.id;

          return (
            <label
              key={model.id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border p-4 transition-colors',
                selected
                  ? 'border-clinical-500 bg-clinical-50/60 ring-2 ring-clinical-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
                !ready && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name="modelId"
                value={model.id}
                checked={selected}
                disabled={!ready}
                onChange={() => onChange(model.id)}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <Cpu className="size-4 text-clinical-700" aria-hidden />
                  {model.name}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                    ready
                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                      : 'bg-red-50 text-red-700 ring-red-200',
                  )}
                >
                  {ready ? 'Ready' : 'Offline'}
                </span>
              </span>
              <span className="mt-2 text-sm leading-relaxed text-slate-600">{model.description}</span>
              {model.evaluation.accuracy != null ? (
                <span className="mt-2 text-xs tabular-nums text-slate-500">
                  Test accuracy {Math.round(model.evaluation.accuracy * 1000) / 10}% on Kermany
                  {model.evaluation.sampleCount ? ` (n=${model.evaluation.sampleCount})` : ''}
                </span>
              ) : (
                <span className="mt-2 text-xs text-slate-500">
                  Independent test metrics not available for this checkpoint.
                </span>
              )}
              {!ready && model.error ? (
                <span className="mt-2 text-xs text-red-700">{model.error}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
