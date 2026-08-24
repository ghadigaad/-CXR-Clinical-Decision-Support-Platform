/**
 * Thin fetch wrapper.
 *
 * Every request sends the session cookie and nothing else - there is no token in
 * localStorage and no API key in this bundle, because all privileged access is brokered
 * by the backend.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export type ApiErrorCode =
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
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly issues: FieldIssue[];

  constructor(status: number, code: ApiErrorCode, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** True when the clinician can fix the problem by changing their input. */
  get isUserFixable(): boolean {
    return (
      this.code === 'VALIDATION_ERROR' ||
      this.code === 'UNSUPPORTED_MEDIA_TYPE' ||
      this.code === 'UNPROCESSABLE_IMAGE' ||
      this.code === 'PAYLOAD_TOO_LARGE' ||
      this.code === 'CONFLICT'
    );
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Non-JSON error bodies (proxy errors, HTML pages) fall through to the default.
  }

  const code = (body.error?.code ?? 'INTERNAL_ERROR') as ApiErrorCode;
  let message = body.error?.message ?? `Request failed with status ${response.status}.`;

  const details = body.error?.details;
  const issues: FieldIssue[] = Array.isArray(details)
    ? (details as FieldIssue[]).filter(
        (item): item is FieldIssue =>
          typeof item?.field === 'string' && typeof item?.message === 'string',
      )
    : [];

  // A lone validation issue is more useful than the generic wrapper text, especially for
  // form-level rules that have no field to attach to.
  if (code === 'VALIDATION_ERROR' && issues.length === 1 && issues[0]) {
    message = issues[0].message;
  }

  return new ApiError(response.status, code, message, issues);
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const isFormData = body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(isFormData || body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
