import { Student } from './student-api';
import { Semester } from './semester-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SummaryPoint {
  _id: string;
  student_id: Student | string;
  semester_id: Semester | string;
  total_score: number;
  grading: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSummaryPointDto {
  student_id: string;
  semester_id: string;
  total_score: number;
  grading: string;
  status?: 'active' | 'inactive';
}

export interface UpdateSummaryPointDto {
  student_id?: string;
  semester_id?: string;
  total_score?: number;
  grading?: string;
  status?: 'active' | 'inactive';
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const summariesPointApi = {
  async getSummariesPoints(): Promise<SummaryPoint[]> {
    const res = await fetch(`${API_BASE}/summaries-point`);
    return handleResponse<SummaryPoint[]>(res);
  },

  async getSummariesPoint(id: string): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-point/${id}`);
    return handleResponse<SummaryPoint>(res);
  },

  async createSummariesPoint(dto: CreateSummaryPointDto): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-point`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async updateSummariesPoint(id: string, dto: UpdateSummaryPointDto): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-point/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async deleteSummariesPoint(id: string): Promise<SummaryPoint> {
    const res = await fetch(`${API_BASE}/summaries-point/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<SummaryPoint>(res);
  }
};
