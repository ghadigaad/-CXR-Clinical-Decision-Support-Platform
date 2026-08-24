/**
 * In-process idempotency for analysis submissions.
 *
 * The frontend disables its submit button while a request is in flight, but that alone
 * does not survive a refresh, a flaky connection retry, or a second browser tab. This
 * keeps a short-lived map of client request ids so a repeat submission returns the
 * original analysis instead of paying for a second inference run.
 *
 * Deliberately in-memory: the window is seconds long and the failure mode of losing it
 * (one duplicate analysis) is mild. A multi-instance deployment behind a load balancer
 * should move this to Redis, keyed the same way.
 */

const TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

interface Entry {
  /** null while inference is still running. */
  analysisId: string | null;
  expiresAt: number;
}

const entries = new Map<string, Entry>();

function keyFor(doctorId: string, requestId: string): string {
  // Namespaced by clinician so a guessed request id from another session cannot collide.
  return `${doctorId}:${requestId}`;
}

function sweep(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
// Do not hold the event loop open on shutdown.
timer.unref?.();

/** Returns the completed analysis id for a known request, or null. */
export function resolveRequest(doctorId: string, requestId: string): string | null {
  const entry = entries.get(keyFor(doctorId, requestId));
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.analysisId;
}

export function claimRequest(doctorId: string, requestId: string): void {
  entries.set(keyFor(doctorId, requestId), { analysisId: null, expiresAt: Date.now() + TTL_MS });
}

/** Record the outcome. Passing null drops the claim so a failed attempt can be retried. */
export function releaseRequest(
  doctorId: string,
  requestId: string,
  analysisId: string | null,
): void {
  const key = keyFor(doctorId, requestId);
  if (analysisId === null) {
    entries.delete(key);
    return;
  }
  entries.set(key, { analysisId, expiresAt: Date.now() + TTL_MS });
}
