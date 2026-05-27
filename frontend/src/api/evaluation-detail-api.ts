import { SummaryPoint } from './summaries-point-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface EvaluationDetail {
  _id: string;
  summary_id: SummaryPoint | string;
  criterion_id: any | string;
  student_score: number;
  advisor_score: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEvaluationDetailDto {
  summary_id: string;
  criterion_id: string;
  student_score: number;
  advisor_score: number;
}

export interface UpdateEvaluationDetailDto {
  summary_id?: string;
  criterion_id?: string;
  student_score?: number;
  advisor_score?: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const evaluationDetailApi = {
  async getEvaluationDetails(): Promise<EvaluationDetail[]> {
    const res = await fetch(`${API_BASE}/evaluation-detail`);
    return handleResponse<EvaluationDetail[]>(res);
  },

  async getEvaluationDetail(id: string): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail/${id}`);
    return handleResponse<EvaluationDetail>(res);
  },

  async getEvaluationDetailsBySummary(summaryId: string): Promise<EvaluationDetail[]> {
    const res = await fetch(`${API_BASE}/evaluation-detail/summary/${summaryId}`);
    return handleResponse<EvaluationDetail[]>(res);
  },

  async createEvaluationDetail(dto: CreateEvaluationDetailDto): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async updateEvaluationDetail(id: string, dto: UpdateEvaluationDetailDto): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationDetail>(res);
  },

  async deleteEvaluationDetail(id: string): Promise<EvaluationDetail> {
    const res = await fetch(`${API_BASE}/evaluation-detail/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<EvaluationDetail>(res);
  }
};
