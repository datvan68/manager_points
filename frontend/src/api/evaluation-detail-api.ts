import { httpClient, handleResponse } from './http-client';
import { SummaryPoint } from './summaries-point-api';

import { API_BASE } from './config';

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
  selected_option_id?: string | null;
  selected_option_label?: string | null;
  selected_option_score?: number | null;
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
  selected_option_id?: string | null;
  selected_option_label?: string | null;
  selected_option_score?: number | null;
  system_score?: number | null;
  sv_score?: number | null;
  sv_submitted_at?: string | Date | null;
  gv_score?: number | null;
  gv_reviewed_at?: string | Date | null;
  gv_reviewed_by?: string | null;
  description?: string;
}

export interface UpdateEvaluationDetailDto {
  summary_id?: string;
  criterion_id?: string;
  current_count?: number;
  log?: EvaluationLog[];
  status?: string;
  selected_option_id?: string | null;
  selected_option_label?: string | null;
  selected_option_score?: number | null;
  system_score?: number | null;
  sv_score?: number | null;
  sv_submitted_at?: string | Date | null;
  gv_score?: number | null;
  gv_reviewed_at?: string | Date | null;
  gv_reviewed_by?: string | null;
  description?: string;
}

export const evaluationDetailApi = {
  async getEvaluationDetails(params?: {
    page?: number;
    limit?: number;
    summaryId?: string;
    semesterId?: string;
    classId?: string;
    studentId?: string;
  }): Promise<EvaluationDetail[] | { data: EvaluationDetail[]; meta: any }> {
    const queryParts: string[] = [];
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParts.push(`${key}=${encodeURIComponent(val)}`);
        }
      });
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const res = await httpClient(`${API_BASE}/evaluation-detail${queryString}`);
    return handleResponse<any>(res);
  },

  async getEvaluationDetail(id: string): Promise<EvaluationDetail> {
    const res = await httpClient(`${API_BASE}/evaluation-detail/${id}`);
    return handleResponse<EvaluationDetail>(res);
  },

  async getEvaluationDetailsBySummary(summaryId: string, includeLogs?: boolean): Promise<EvaluationDetail[]> {
    const qs = includeLogs !== undefined ? `?includeLogs=${includeLogs}` : '';
    const res = await httpClient(`${API_BASE}/evaluation-detail/summary/${summaryId}${qs}`);
    return handleResponse<EvaluationDetail[]>(res);
  },

  async createEvaluationDetail(dto: CreateEvaluationDetailDto): Promise<EvaluationDetail> {
    const res = await httpClient(`${API_BASE}/evaluation-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async updateEvaluationDetail(id: string, dto: UpdateEvaluationDetailDto): Promise<EvaluationDetail> {
    const res = await httpClient(`${API_BASE}/evaluation-detail/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async bulkUpsertEvaluationDetails(dto: { summary_id: string; details: any[]; reason?: string }): Promise<any> {
    const res = await httpClient(`${API_BASE}/evaluation-detail/bulk-upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<any>(res);
  },

  async deleteEvaluationDetail(id: string): Promise<EvaluationDetail> {
    const res = await httpClient(`${API_BASE}/evaluation-detail/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<EvaluationDetail>(res);
  },

  /**
   * Đếm số academic_record đã có sẵn cho tất cả tiêu chí của 1 summary.
   * Trả về map { criterionId: count }
   */
  async getPreExistingCounts(summaryId: string): Promise<Record<string, { original_count: number; current_count: number }>> {
    const res = await httpClient(`${API_BASE}/evaluation-detail/pre-counts/${summaryId}`);
    return handleResponse<Record<string, { original_count: number; current_count: number }>>(res);
  },

  /**
   * Đếm hàng loạt số academic_record đã có sẵn cho nhiều summaries.
   */
  async getPreExistingCountsBulk(summaryIds: string[]): Promise<Record<string, Record<string, { original_count: number; current_count: number }>>> {
    const res = await httpClient(`${API_BASE}/evaluation-detail/pre-counts/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryIds }),
    });
    return handleResponse<Record<string, Record<string, { original_count: number; current_count: number }>>>(res);
  }
};

