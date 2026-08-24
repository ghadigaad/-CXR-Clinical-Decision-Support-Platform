import { ChevronRight, ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatDateTime, formatModelName, formatPercent } from '../../lib/utils';
import type { Analysis } from '../../types/api';
import { AiBadge, Badge, RiskBadge, StatusBadge } from '../ui/Badge';

function Thumbnail({ analysis }: { analysis: Analysis }) {
  if (!analysis.image.thumbnail) {
    return (
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300"
        title="Image not retained by this deployment"
      >
        <ImageOff className="size-4" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={analysis.image.thumbnail}
      alt=""
      className="size-12 shrink-0 rounded-md border border-slate-200 bg-slate-950 object-cover"
    />
  );
}

/**
 * Shared listing used by the dashboard, reports page, and patient history.
 *
 * Renders as a table on wide screens and as stacked cards on narrow ones, rather than
 * forcing horizontal scrolling on a phone.
 */
export function AnalysisTable({
  analyses,
  showPatient = true,
}: {
  analyses: Analysis[];
  showPatient?: boolean;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3 font-medium">
                Study
              </th>
              {showPatient ? (
                <th scope="col" className="px-3 py-3 font-medium">
                  Patient
                </th>
              ) : null}
              <th scope="col" className="px-3 py-3 font-medium">
                AI prediction
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Confidence
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Risk
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Assessment
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analyses.map((analysis) => (
              <tr key={analysis.id} className="transition-colors hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Thumbnail analysis={analysis} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900">
                        {formatDateTime(analysis.createdAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatModelName(analysis.modelName ?? analysis.modelVersion)}
                      </p>
                      {analysis.source === 'mock' ? (
                        <Badge tone="warning" className="mt-1">
                          Mock
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </td>

                {showPatient ? (
                  <td className="px-3 py-3">
                    <p className="truncate font-medium text-slate-900">
                      {analysis.patient?.fullName ?? '—'}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {analysis.patient?.medicalRecordNumber ?? ''}
                    </p>
                  </td>
                ) : null}

                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900">{analysis.prediction.label}</span>
                    <AiBadge label="AI" className="hidden xl:inline-flex" />
                  </div>
                </td>

                <td className="px-3 py-3 tabular-nums text-slate-700">
                  {formatPercent(analysis.prediction.confidence)}
                </td>

                <td className="px-3 py-3">
                  <RiskBadge risk={analysis.riskLevel} />
                </td>

                <td className="max-w-[16rem] px-3 py-3">
                  <p className="truncate text-slate-600">
                    {analysis.review?.finalAssessment ?? (
                      <span className="text-slate-400">Not recorded</span>
                    )}
                  </p>
                </td>

                <td className="px-3 py-3">
                  <StatusBadge status={analysis.status} />
                </td>

                <td className="px-5 py-3 text-right">
                  <Link
                    to={`/analysis/${analysis.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-clinical-700 hover:underline"
                  >
                    Open
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {analyses.map((analysis) => (
          <li key={analysis.id}>
            <Link
              to={`/analysis/${analysis.id}`}
              className="flex gap-3 px-4 py-4 transition-colors hover:bg-slate-50"
            >
              <Thumbnail analysis={analysis} />
              <div className="min-w-0 flex-1">
                {showPatient ? (
                  <p className="truncate font-medium text-slate-900">
                    {analysis.patient?.fullName ?? 'Unknown patient'}
                  </p>
                ) : null}
                <p className="text-xs text-slate-500">{formatDateTime(analysis.createdAt)}</p>
                <p className="text-xs text-slate-500">
                  {formatModelName(analysis.modelName ?? analysis.modelVersion)}
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {analysis.prediction.label}{' '}
                  <span className="tabular-nums text-slate-500">
                    · {formatPercent(analysis.prediction.confidence)}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <RiskBadge risk={analysis.riskLevel} />
                  <StatusBadge status={analysis.status} />
                  {analysis.source === 'mock' ? <Badge tone="warning">Mock</Badge> : null}
                </div>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
