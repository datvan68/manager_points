import { httpClient, handleResponse } from './http-client';
import { Student } from './student-api';
import { Semester } from './semester-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SummaryPoint {
  _id: string;
  student_id: Student | string;
  semester_id: Semester | string;
  period_id?: any;
  total_score: number | null;
  grading: string | null;
  status: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked';
  rank_tier?: 'diamond' | 'gold' | 'silver' | 'bronze' | 'unranked';
  rank_label?: string;
  rank_locked_at?: string;
  rank_updated_by?: string;
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
  async getSummariesPoints(params?: {
    page?: number;
    limit?: number;
    semesterId?: string;
    classId?: string;
    studentId?: string;
    status?: string;
  }): Promise<{ data: SummaryPoint[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.semesterId) query.set('semesterId', params.semesterId);
    if (params?.classId) query.set('classId', params.classId);
    if (params?.studentId) query.set('studentId', params.studentId);
    if (params?.status) query.set('status', params.status);
    
    const qs = query.toString();
    const url = `${API_BASE}/summaries-points${qs ? `?${qs}` : ''}`;
    const res = await httpClient(url);
    return handleResponse<{ data: SummaryPoint[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(res);
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
  },

  async approveGrading(id: string): Promise<SummaryPoint> {
    const res = await httpClient(`${API_BASE}/summaries-points/${id}/approve`, {
      method: 'PATCH',
    });
    return handleResponse<SummaryPoint>(res);
  },

  async finalizeSummaryPoint(id: string): Promise<SummaryPoint> {
    return this.approveGrading(id);
  },

  async getMyLatestSummary(params?: { semesterId?: string; periodId?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.semesterId) query.set('semesterId', params.semesterId);
    if (params?.periodId) query.set('periodId', params.periodId);
    const qs = query.toString();
    const url = `${API_BASE}/summaries-points/me/latest${qs ? `?${qs}` : ''}`;
    const res = await httpClient(url);
    return handleResponse<any>(res);
  },

  async cancelApprovalBulk(summaryIds: string[], reason?: string): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/summaries-points/cancel-approval/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryIds, reason }),
    });
    return handleResponse<any[]>(res);
  }
};
