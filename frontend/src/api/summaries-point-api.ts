import { httpClient, handleResponse } from './http-client';
import { Student } from './student-api';
import { Semester } from './semester-api';

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

export const summariesPointApi = {
  async getSummariesPoints(): Promise<SummaryPoint[]> {
    const res = await httpClient(`${API_BASE}/summaries-points`);
    return handleResponse<SummaryPoint[]>(res);
  },

  async getSummariesPoint(id: string): Promise<SummaryPoint> {
    const res = await httpClient(`${API_BASE}/summaries-points/${id}`);
    return handleResponse<SummaryPoint>(res);
  },

  async createSummariesPoint(dto: CreateSummaryPointDto): Promise<SummaryPoint> {
    const res = await httpClient(`${API_BASE}/summaries-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async updateSummariesPoint(id: string, dto: UpdateSummaryPointDto): Promise<SummaryPoint> {
    const res = await httpClient(`${API_BASE}/summaries-points/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<SummaryPoint>(res);
  },

  async deleteSummariesPoint(id: string): Promise<SummaryPoint> {
    const res = await httpClient(`${API_BASE}/summaries-points/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<SummaryPoint>(res);
  }
};
