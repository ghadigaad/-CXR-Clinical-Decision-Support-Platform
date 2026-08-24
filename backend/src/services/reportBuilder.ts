/**
 * Turns raw model output into the structured content of a clinical report.
 *
 * Scope discipline matters here: this module may describe and rank what the model
 * returned, and it may state the confidence of that output. It must not add clinical
 * interpretation, differential diagnoses, or treatment advice, because the model
 * supplies none of those. Recommendations are therefore always empty for the current
 * classifier - see buildRecommendations().
 */
import type { RiskLevel } from '@prisma/client';

import type { ClassProbability, InferenceResult } from './ai/types.js';

export const AI_DISCLAIMER =
  'AI-generated results are intended to support clinical decision-making and should be ' +
  'reviewed and interpreted by a qualified healthcare professional. This output is not a ' +
  'definitive medical diagnosis.';

export const MOCK_WARNING =
  'This result was produced by a development stub, not by the trained model. It carries no ' +
  'clinical meaning and must not be used for patient care.';

/** Labels the classifier treats as an abnormal finding. */
const ABNORMAL_LABELS = new Set(['Bacterial Pneumonia', 'Viral Pneumonia']);

/**
 * Confidence bands used to derive a triage-oriented risk level.
 *
 * This is a system-derived heuristic over the model's probabilities, not an output of
 * the model itself. The UI labels it as such. Thresholds are intentionally conservative:
 * an abnormal prediction is never reported below MODERATE, and low-confidence output of
 * any kind is escalated so it draws a reviewer's attention rather than being dismissed.
 */
export const RISK_THRESHOLDS = {
  highConfidence: 0.85,
  lowConfidence: 0.6,
} as const;

export function deriveRiskLevel(result: InferenceResult): RiskLevel {
  const isAbnormal = ABNORMAL_LABELS.has(result.predictedLabel);

  if (isAbnormal) {
    return result.confidence >= RISK_THRESHOLDS.highConfidence ? 'HIGH' : 'MODERATE';
  }

  // Predicted normal, but the model is unsure - worth a closer look.
  return result.confidence < RISK_THRESHOLDS.lowConfidence ? 'MODERATE' : 'LOW';
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function describeConfidence(confidence: number): string {
  if (confidence >= RISK_THRESHOLDS.highConfidence) return 'high confidence';
  if (confidence >= RISK_THRESHOLDS.lowConfidence) return 'moderate confidence';
  return 'low confidence';
}

/**
 * Findings are the model's own class probabilities, ordered by likelihood. Nothing is
 * added that the classifier did not produce.
 */
export function buildFindings(result: InferenceResult): ClassProbability[] {
  return [...result.probabilities].sort((a, b) => b.probability - a.probability);
}

export function buildObservations(result: InferenceResult): string[] {
  const ranked = buildFindings(result);
  const observations: string[] = [];

  for (const item of ranked) {
    observations.push(`${item.label}: ${formatPercent(item.probability)}`);
  }

  const [top, second] = ranked;
  if (top && second && top.probability - second.probability < 0.15) {
    observations.push(
      `The two highest-scoring classes are separated by only ` +
        `${formatPercent(top.probability - second.probability)}, indicating the model did not ` +
        `discriminate strongly between "${top.label}" and "${second.label}".`,
    );
  }

  if (result.confidence < RISK_THRESHOLDS.lowConfidence) {
    observations.push(
      'Overall confidence is below the low-confidence threshold; this output warrants ' +
        'particularly careful review.',
    );
  }

  return observations;
}

export function buildImpression(result: InferenceResult): string {
  if (result.source === 'mock') {
    return MOCK_WARNING;
  }

  const confidenceText = describeConfidence(result.confidence);
  const percent = formatPercent(result.confidence);

  const lead =
    `Automated classification of this chest radiograph returned ` +
    `"${result.predictedLabel}" with ${confidenceText} (${percent}).`;

  const context = ABNORMAL_LABELS.has(result.predictedLabel)
    ? 'The model assigned the highest probability to a pneumonia class; correlation with the ' +
      'clinical presentation and direct review of the image are required.'
    : 'The model did not assign the highest probability to either pneumonia class. This does ' +
      'not exclude disease that the model was not trained to detect.';

  return `${lead} ${context} ${AI_DISCLAIMER}`;
}

/**
 * The current classifier outputs three class probabilities and nothing else - no
 * management guidance, no follow-up intervals. Returning an empty array keeps the
 * report honest, and the UI hides the section when it is empty.
 *
 * If a future model emits structured recommendations, map them here rather than
 * composing text from the prediction label.
 */
export function buildRecommendations(_result: InferenceResult): string[] {
  return [];
}

export interface ReportContent {
  impression: string;
  observations: string[];
  recommendations: string[];
  riskLevel: RiskLevel;
  findings: ClassProbability[];
}

export function buildReportContent(result: InferenceResult): ReportContent {
  return {
    impression: buildImpression(result),
    observations: buildObservations(result),
    recommendations: buildRecommendations(result),
    riskLevel: deriveRiskLevel(result),
    findings: buildFindings(result),
  };
}
