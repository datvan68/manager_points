import { httpClient, handleResponse } from './http-client';
import { Class } from './class-api';

import { API_BASE } from './config';

export interface Student {
  _id: string;
  student_code: string;
  full_name: string;
  email?: string;
  date_bir: string; // ISO string / Date string
  sex: 'Male' | 'Female' | 'Other';
  status: 'Studying' | 'Reserved' | 'Dropped' | 'Graduated' | 'Suspended';
  class_id?: Class | string;
  training_point_id?: {
    _id: string;
    total_score?: number | null;
    grading?: string | null;
    status?: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked';
    rank_tier?: string | null;
    rank_label?: string | null;
  } | string | null;
  training_point_history?: Array<{
    semester_id: string;
    period_id: string;
    total_score: number;
    grading?: string | null;
    rank_tier?: string | null;
    rank_label?: string | null;
    locked_at: string;
  }>;
  user_id?: { _id: string; user_name?: string; email?: string; status?: string } | string;
  account_status?: 'active' | 'inactive' | 'locked';
  createdAt?: string;
  updatedAt?: string;
  has_dormitory_roster?: boolean;
}

export const studentApi = {
  async getStudents(params?: {
    page?: number;
    limit?: number;
    classId?: string;
    departmentId?: string;
    search?: string;
    status?: string;
    fields?: string;
    signal?: AbortSignal;
  }): Promise<{ data: Student[]; meta?: any } | Student[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.classId) query.set('classId', params.classId);
    if (params?.departmentId) query.set('departmentId', params.departmentId);
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.fields) query.set('fields', params.fields);
    
    const qs = query.toString();
    const url = `${API_BASE}/students${qs ? `?${qs}` : ''}`;
    const res = await httpClient(url, { signal: params?.signal });
    return handleResponse(res);
  },

  async getMyStudent(): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/me`);
    return handleResponse<Student>(res);
  },

  async getStudent(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}`);
    return handleResponse<Student>(res);
  },

  async resolveStudent(identifier: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/resolve?identifier=${encodeURIComponent(identifier)}`);
    return handleResponse<Student>(res);
  },

  async createStudent(dto: Partial<Student>): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Student>(res);
  },

  async createStudentBulk(dtos: Partial<Student>[]): Promise<Student[]> {
    const res = await httpClient(`${API_BASE}/students/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dtos),
    });
    return handleResponse<Student[]>(res);
  },

  async checkDuplicate(studentCodes: string[]): Promise<{ student_code: string; full_name: string }[]> {
    const res = await httpClient(`${API_BASE}/students/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCodes }),
    });
    return handleResponse<{ student_code: string; full_name: string }[]>(res);
  },

  async updateStudent(id: string, dto: Partial<Student>): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Student>(res);
  },

  async deleteStudent(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Student>(res);
  },

  async activateStudent(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}/activate`, {
      method: 'POST',
    });
    return handleResponse<Student>(res);
  },

  async bulkActivateStudents(studentIds: string[]): Promise<{ success: number; total: number; results: any[] }> {
    const res = await httpClient(`${API_BASE}/students/bulk-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIds }),
    });
    return handleResponse<{ success: number; total: number; results: any[] }>(res);
  },

  async resetStudentPassword(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}/reset-password`, {
      method: 'POST',
    });
    return handleResponse<Student>(res);
  },

  async lockStudent(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}/lock`, {
      method: 'POST',
    });
    return handleResponse<Student>(res);
  },

  async unlockStudent(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}/unlock`, {
      method: 'POST',
    });
    return handleResponse<Student>(res);
  },

  async previewImportStudents(classId: string, rows: any[]): Promise<any> {
    const res = await httpClient(`${API_BASE}/students/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, rows }),
    });
    return handleResponse<any>(res);
  },

  async confirmImportStudents(sessionId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/students/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return handleResponse<any>(res);
  },

  async getImportStudentsProgress(sessionId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/students/import/${sessionId}/progress`);
    return handleResponse<any>(res);
  }
};

