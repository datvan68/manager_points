import { Student } from './student-api';
import { Semester } from './semester-api';
import { tokenStorage } from './auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SummaryPoint {
  _id: string;
  student_id: Student | string;
  semester_id: Semester | string;
  total_score: number;
  grading: string;
  status: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSummaryPointDto {
  student_id: string;
  semester_id: string;
  total_score: number;
  grading: string;
  status?: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked';
}

export interface UpdateSummaryPointDto {
  student_id?: string;
  semester_id?: string;
  total_score?: number;
  grading?: string;
  status?: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked';
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

export const summariesPointApi = {
  async getSummariesPoints(): Promise<SummaryPoint[]> {
    const res = await fetch(`${API_BASE}/summaries-points`, {
      headers: authHeaders(),
    });
    return handleResponse<SummaryPoint[]>(res);
  },

  async getSummariesPoint(id: string): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-points/${id}`, {
      headers: authHeaders(),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async createSummariesPoint(dto: CreateSummaryPointDto): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-points`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(dto),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async updateSummariesPoint(id: string, dto: UpdateSummaryPointDto): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-points/${id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(dto),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async deleteSummariesPoint(id: string): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-points/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse<SummaryPoint>(res);
  }
};
