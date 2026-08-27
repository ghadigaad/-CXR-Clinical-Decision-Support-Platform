/** Typed endpoint wrappers and the shared React Query key registry. */
import type {
  Analysis,
  AnalysisStatus,
  DashboardStats,
  Doctor,
  ModelInfo,
  Pagination,
  Patient,
  PatientListItem,
  RiskLevel,
} from '../types/api';
import { api } from './client';

/* ------------------------------- Query keys ------------------------------- */

export const queryKeys = {
  session: ['session'] as const,
  modelInfo: ['model-info'] as const,
  stats: ['analyses', 'stats'] as const,
  patients: (filters?: PatientFilters) => ['patients', filters ?? {}] as const,
  patient: (id: string) => ['patients', id] as const,
  patientAnalyses: (id: string) => ['patients', id, 'analyses'] as const,
  analyses: (filters?: AnalysisFilters) => ['analyses', filters ?? {}] as const,
  analysis: (id: string) => ['analyses', id] as const,
};

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

/* --------------------------------- Auth ---------------------------------- */

export const authApi = {
  requestOtp: (email: string) => api.post<{ sent: boolean }>('/api/auth/request-otp', { email }),
  verifyOtp: (email: string, token: string) =>
    api.post<{ doctor: Doctor }>('/api/auth/verify-otp', { email, token }),
  logout: () => api.post<{ success: boolean }>('/api/auth/logout'),
  me: () => api.get<{ doctor: Doctor }>('/api/auth/me'),
};

/* ------------------------------- Patients -------------------------------- */

export interface PatientFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PatientInput {
  medicalRecordNumber: string;
  fullName: string;
  age: number;
  gender: string;
  dateOfBirth?: string;
  clinicalHistory?: string;
  symptoms?: string;
  notes?: string;
}

export const patientsApi = {
  list: (filters: PatientFilters = {}) =>
    api.get<{ patients: PatientListItem[]; pagination: Pagination }>(
      `/api/patients${toQueryString(filters)}`,
    ),
  get: (id: string) => api.get<{ patient: Patient }>(`/api/patients/${id}`),
  create: (input: PatientInput) => api.post<{ patient: Patient }>('/api/patients', input),
  update: (id: string, input: Partial<PatientInput>) =>
    api.patch<{ patient: Patient }>(`/api/patients/${id}`, input),
  analyses: (id: string) =>
    api.get<{ patient: Patient; analyses: Analysis[] }>(`/api/patients/${id}/analyses`),
};

/* ------------------------------- Analyses -------------------------------- */

export interface AnalysisFilters {
  search?: string;
  status?: AnalysisStatus;
  prediction?: string;
  riskLevel?: RiskLevel;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type ModelId = 'densenet-cbam' | 'efficientnetv2';

export interface AnalyzeInput {
  patientId: string;
  image: File;
  /** Idempotency key so a retry or double-click cannot create a second analysis. */
  requestId: string;
  modelId: ModelId;
}

export interface AnalyzeResponse {
  analysis: Analysis;
  disclaimer: string;
  duplicate: boolean;
}

export interface ReviewInput {
  comments?: string;
  additionalFindings?: string;
  finalAssessment?: string;
  agreesWithAi?: boolean | null;
}

export const analysesApi = {
  analyze: ({ patientId, image, requestId, modelId }: AnalyzeInput) => {
    const form = new FormData();
    form.append('patientId', patientId);
    form.append('requestId', requestId);
    form.append('modelId', modelId);
    form.append('image', image);
    return api.post<AnalyzeResponse>('/api/analyze', form);
  },
  list: (filters: AnalysisFilters = {}) =>
    api.get<{ analyses: Analysis[]; pagination: Pagination }>(
      `/api/analyses${toQueryString(filters)}`,
    ),
  get: (id: string) => api.get<{ analysis: Analysis; disclaimer: string }>(`/api/analyses/${id}`),
  report: (id: string) =>
    api.get<{ analysis: Analysis; disclaimer: string; generatedAt: string }>(
      `/api/analyses/${id}/report`,
    ),
  review: (id: string, input: ReviewInput) =>
    api.patch<{ analysis: Analysis }>(`/api/analyses/${id}/review`, input),
  finalize: (id: string, input: ReviewInput & { finalAssessment: string }) =>
    api.post<{ analysis: Analysis }>(`/api/analyses/${id}/finalize`, input),
  stats: () => api.get<{ stats: DashboardStats }>('/api/analyses/stats'),
};

/* -------------------------------- System --------------------------------- */

export const systemApi = {
  modelInfo: () => api.get<ModelInfo>('/api/system/model-info'),
};
