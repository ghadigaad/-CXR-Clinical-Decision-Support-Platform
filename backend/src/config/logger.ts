/**
 * Minimal leveled logger.
 *
 * Deliberately dependency-free and deliberately dumb about payloads: callers pass
 * identifiers and counts, never patient fields, so logs stay free of PHI.
 */
import { env } from './env.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

type Level = keyof typeof LEVELS;

const threshold = LEVELS[env.LOG_LEVEL];

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;

  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...(context ?? {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
