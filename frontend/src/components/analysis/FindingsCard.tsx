import { formatPercent } from '../../lib/utils';
import type { Analysis } from '../../types/api';
import { AiBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';

/**
 * Detected findings and the model's observations.
 *
 * Everything shown here comes from the analysis payload. When the model returns no
 * recommendations - which is the case for the current classifier - the section is
 * omitted rather than filled with generic advice.
 */
export function FindingsCard({ analysis }: { analysis: Analysis }) {
  const report = analysis.report;
  const ranked = [...analysis.prediction.probabilities].sort(
    (a, b) => b.probability - a.probability,
  );

  return (
    <Card>
      <CardHeader
        title="AI findings"
        description="Model output for this study."
        actions={<AiBadge />}
      />

      <CardBody className="space-y-5">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Detected findings
          </h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {ranked.map((finding, index) => (
              <li
                key={finding.label}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  {index === 0 ? (
                    <span
                      className="size-1.5 rounded-full bg-ai-500"
                      aria-label="Highest probability"
                    />
                  ) : (
                    <span className="size-1.5 rounded-full bg-slate-300" aria-hidden />
                  )}
                  {finding.label}
                </span>
                <span className="text-sm tabular-nums text-slate-600">
                  {formatPercent(finding.probability)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {report && report.observations.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Observations
            </h3>
            <ul className="mt-2 space-y-1.5">
              {report.observations.map((observation) => (
                <li key={observation} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                  {observation}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report?.impression ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Impression
            </h3>
            <p className="mt-2 rounded-lg bg-ai-50/60 p-3 text-sm leading-relaxed text-slate-700 ring-1 ring-inset ring-ai-100">
              {report.impression}
            </p>
          </div>
        ) : null}

        {report && report.recommendations.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Recommendations
            </h3>
            <ul className="mt-2 space-y-1.5">
              {report.recommendations.map((recommendation) => (
                <li key={recommendation} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                  {recommendation}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            This model does not produce clinical recommendations, so none are shown. Management
            decisions rest with the reviewing clinician.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
