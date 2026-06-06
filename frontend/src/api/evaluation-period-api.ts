import { tokenStorage } from './auth-api';

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

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const evaluationPeriodApi = {
  async getEvaluationPeriods(): Promise<EvaluationPeriod[]> {
    const accessToken = tokenStorage.getAccessToken();
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${API_BASE}/api/evaluation-periods`, { headers });
    return handleResponse<EvaluationPeriod[]>(res);
  },

  async getEvaluationPeriod(id: string): Promise<EvaluationPeriod> {
    const accessToken = tokenStorage.getAccessToken();
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${API_BASE}/api/evaluation-periods/${id}`, { headers });
    return handleResponse<EvaluationPeriod>(res);
  },

  async createEvaluationPeriod(dto: CreateEvaluationPeriodDto): Promise<EvaluationPeriod> {
    const accessToken = tokenStorage.getAccessToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${API_BASE}/api/evaluation-periods`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationPeriod>(res);
  },

  async updateEvaluationPeriod(id: string, dto: UpdateEvaluationPeriodDto): Promise<EvaluationPeriod> {
    const accessToken = tokenStorage.getAccessToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${API_BASE}/api/evaluation-periods/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(dto),
    });
    return handleResponse<EvaluationPeriod>(res);
  },

  async deleteEvaluationPeriod(id: string): Promise<{ message: string }> {
    const accessToken = tokenStorage.getAccessToken();
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${API_BASE}/api/evaluation-periods/${id}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse<{ message: string }>(res);
  }
};
