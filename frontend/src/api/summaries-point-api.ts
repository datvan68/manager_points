import { httpClient, handleResponse } from './http-client';
import { Student } from './student-api';
import { Semester } from './semester-api';

const API_BASE = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '')}/api`;

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

export interface LatestStudentSummary {
  _id: string;
  status: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked';
  total_score: number | null;
  grading: string | null;
  rank_tier?: 'diamond' | 'gold' | 'silver' | 'bronze' | 'unranked';
  rank_label?: string;
  semester: string;
  period?: any;
  locked_at: string;
  studentName?: string;
  className?: string;
  student?: {
    full_name: string;
    student_code: string;
    class_id: {
      _id: string;
      class_name: string;
    } | null;
  };
}

export const summariesPointApi = {
  async getSummariesPoints(params?: {
    page?: number;
    limit?: number;
    semesterId?: string;
    classId?: string;
    studentId?: string;
    studentIds?: string | string[];
    status?: string;
  }): Promise<{ data: SummaryPoint[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.semesterId) query.set('semesterId', params.semesterId);
    if (params?.classId) query.set('classId', params.classId);
    if (params?.studentId) query.set('studentId', params.studentId);
    if (params?.studentIds) {
      const idsParam = Array.isArray(params.studentIds) ? params.studentIds.join(',') : params.studentIds;
      query.set('studentIds', idsParam);
    }
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

  async getMyLatestSummary(params?: { semesterId?: string; periodId?: string }): Promise<LatestStudentSummary | null> {
    const query = new URLSearchParams();
    if (params?.semesterId) query.set('semesterId', params.semesterId);
    if (params?.periodId) query.set('periodId', params.periodId);
    const qs = query.toString();
    const url = `${API_BASE}/summaries-points/me/latest${qs ? `?${qs}` : ''}`;
    const res = await httpClient(url);
    return handleResponse<LatestStudentSummary | null>(res);
  },

  async cancelApprovalBulk(summaryIds: string[], reason?: string): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/summaries-points/cancel-approval/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryIds, reason }),
    });
    return handleResponse<any[]>(res);
  },

  async initializeClass(classId: string, semesterId: string): Promise<{ success: boolean; createdCount: number }> {
    const res = await httpClient(`${API_BASE}/summaries-points/initialize-class`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, semesterId }),
    });
    return handleResponse<{ success: boolean; createdCount: number }>(res);
  },

  async exportPdf(payload: any): Promise<Blob> {
    const res = await httpClient(`${API_BASE}/summaries-points/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = text || 'Không thể kết xuất PDF từ Server';
      try {
        const data = text ? JSON.parse(text) : {};
        message = data.message || data.error || message;
      } catch {
        // Keep plain text message.
      }
      throw new Error(message);
    }

    return res.blob();
  }
};
