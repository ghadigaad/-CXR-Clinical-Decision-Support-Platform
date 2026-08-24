/** Typed application errors that map cleanly onto HTTP responses. */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE_IMAGE'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'REPORT_FINALIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Authentication required.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Resource not found.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const payloadTooLarge = (message: string) =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', message);

export const unsupportedMediaType = (message: string) =>
  new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message);

export const unprocessableImage = (message: string) =>
  new AppError(422, 'UNPROCESSABLE_IMAGE', message);

export const aiUnavailable = (message: string, details?: unknown) =>
  new AppError(503, 'AI_SERVICE_UNAVAILABLE', message, details);

export const reportFinalized = (message = 'This report has been finalized and can no longer be modified.') =>
  new AppError(409, 'REPORT_FINALIZED', message);
