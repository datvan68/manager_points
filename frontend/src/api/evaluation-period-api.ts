import { httpClient, handleResponse } from './http-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface EvaluationPeriod {
  _id: string;
  semester_id: any; // Can be Semester object or ID
  status: 'pending' | 'sv_phase' | 'gv_phase' | 'admin_phase' | 'closed';
  sv_deadline: string;
  gv_deadline: string;
  admin_deadline: string;
  created_by?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEvaluationPeriodDto {
  semester_id: string;
  status?: 'pending' | 'sv_phase' | 'gv_phase' | 'admin_phase' | 'closed';
  sv_deadline: string;
  gv_deadline: string;
  admin_deadline: string;
}

export interface UpdateEvaluationPeriodDto {
  semester_id?: string;
  status?: 'pending' | 'sv_phase' | 'gv_phase' | 'admin_phase' | 'closed';
  sv_deadline?: string;
  gv_deadline?: string;
  admin_deadline?: string;
}

export const evaluationPeriodApi = {
  async getEvaluationPeriods(): Promise<EvaluationPeriod[]> {
    const res = await httpClient(`${API_BASE}/api/evaluation-periods`);
    return handleResponse<EvaluationPeriod[]>(res);
  },

  async getEvaluationPeriod(id: string): Promise<EvaluationPeriod> {
    const res = await httpClient(`${API_BASE}/api/evaluation-periods/${id}`);
    return handleResponse<EvaluationPeriod>(res);
  },

  async createEvaluationPeriod(dto: CreateEvaluationPeriodDto): Promise<EvaluationPeriod> {
    const res = await httpClient(`${API_BASE}/api/evaluation-periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationPeriod>(res);
  },

  async updateEvaluationPeriod(id: string, dto: UpdateEvaluationPeriodDto): Promise<EvaluationPeriod> {
    const res = await httpClient(`${API_BASE}/api/evaluation-periods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationPeriod>(res);
  },

  async deleteEvaluationPeriod(id: string): Promise<{ message: string }> {
    const res = await httpClient(`${API_BASE}/api/evaluation-periods/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ message: string }>(res);
  }
};
