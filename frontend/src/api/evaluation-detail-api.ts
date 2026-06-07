import { SummaryPoint } from './summaries-point-api';
import { tokenStorage } from './auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface EvaluationLog {
  from_status?: string;
  to_status?: string;
  score_before?: number | null;
  score_after?: number | null;
  updated_by?: any;
  updated_at?: string;
  reason?: string;
  role?: 'student' | 'teacher' | 'supervisor' | 'admin';
  count?: number;
}

export interface EvaluationDetail {
  _id: string;
  summary_id: SummaryPoint | string;
  criterion_id: any | string;
  log: EvaluationLog[];
  current_count: number;
  status: string;
  system_score?: number | null;
  sv_score?: number | null;
  sv_submitted_at?: string | null;
  gv_score?: number | null;
  gv_reviewed_at?: string | null;
  gv_reviewed_by?: string | null;
  final_score?: number | null;
  locked_at?: string | null;
  locked_by?: string | null;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEvaluationDetailDto {
  summary_id: string;
  criterion_id: string;
  current_count?: number;
  log?: EvaluationLog[];
  status?: string;
  system_score?: number | null;
  sv_score?: number | null;
  gv_score?: number | null;
  final_score?: number | null;
  description?: string;
}

export interface UpdateEvaluationDetailDto {
  summary_id?: string;
  criterion_id?: string;
  current_count?: number;
  log?: EvaluationLog[];
  status?: string;
  system_score?: number | null;
  sv_score?: number | null;
  gv_score?: number | null;
  final_score?: number | null;
  description?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = tokenStorage.getAccessToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const evaluationDetailApi = {
  async getEvaluationDetails(): Promise<EvaluationDetail[]> {
    const res = await fetch(`${API_BASE}/evaluation-detail`, {
      headers: authHeaders(),
    });
    return handleResponse<EvaluationDetail[]>(res);
  },

  async getEvaluationDetail(id: string): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail/${id}`, {
      headers: authHeaders(),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async getEvaluationDetailsBySummary(summaryId: string): Promise<EvaluationDetail[]> {
    const res = await fetch(`${API_BASE}/evaluation-detail/summary/${summaryId}`, {
      headers: authHeaders(),
    });
    return handleResponse<EvaluationDetail[]>(res);
  },

  async createEvaluationDetail(dto: CreateEvaluationDetailDto): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async updateEvaluationDetail(id: string, dto: UpdateEvaluationDetailDto): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail/${id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async deleteEvaluationDetail(id: string): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  /**
   * Đếm số academic_record đã có sẵn cho tất cả tiêu chí của 1 summary.
   * Trả về map { criterionId: count }
   */
  async getPreExistingCounts(summaryId: string): Promise<Record<string, { original_count: number; current_count: number }>> {
    const res = await fetch(`${API_BASE}/evaluation-detail/pre-counts/${summaryId}`, {
      headers: authHeaders(),
    });
    return handleResponse<Record<string, { original_count: number; current_count: number }>>(res);
  }
};
