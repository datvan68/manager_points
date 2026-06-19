import { httpClient, handleResponse } from './http-client';
import { Department } from './department-api';
import { apiCache } from './api-cache';

import { API_BASE } from './config';

export interface Class {
  _id: string;
  class_name: string;
  class_year: string;
  dept_id: Department | string;
  advisor_id?: any;
  user_id?: any;
  class_course?: 'Trung cấp' | 'Cao đẳng';
  class_type: 'Trung cấp' | 'Cao đẳng';
  headquarters?: 'Phân hiệu CSSĐ-NDT' | 'Phân hiệu CK';
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassSummary {
  classId: string;
  studentCount: number;
  avatars: Array<{
    _id: string;
    full_name: string;
    student_code: string;
  }>;
}

function normalizeClass(data: any): Class {
  return {
    ...data,
    class_type: data.class_type || data.class_course,
    user_id: data.user_id || data.advisor_id,
  };
}

function normalizeClasses(data: any[]): Class[] {
  return data.map(normalizeClass);
}

function serializeClassPayload(dto: any) {
  const { class_type, ...payload } = dto || {};
  if (class_type && !payload.class_course) {
    payload.class_course = class_type;
  }
  return payload;
}

export const classApi = {
  async getClasses(): Promise<Class[]> {
    return apiCache.get('classes', async () => {
      const res = await httpClient(`${API_BASE}/classes`);
      const data = await handleResponse<any[]>(res);
      return normalizeClasses(data);
    });
  },

  async getClassSummary(): Promise<ClassSummary[]> {
    const res = await httpClient(`${API_BASE}/classes/summary`);
    return handleResponse<ClassSummary[]>(res);
  },

  async getClass(id: string): Promise<Class> {
    const res = await httpClient(`${API_BASE}/classes/${id}`);
    const data = await handleResponse<any>(res);
    return normalizeClass(data);
  },

  async createClass(dto: any): Promise<Class> {
    const res = await httpClient(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeClassPayload(dto)),
    });
    const data = await handleResponse<any>(res);
    const normalized = normalizeClass(data);
    apiCache.invalidate('classes');
    return normalized;
  },

  async updateClass(id: string, dto: any): Promise<Class> {
    const res = await httpClient(`${API_BASE}/classes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeClassPayload(dto)),
    });
    const data = await handleResponse<any>(res);
    const normalized = normalizeClass(data);
    apiCache.invalidate('classes');
    return normalized;
  },

  async deleteClass(id: string): Promise<Class> {
    const res = await httpClient(`${API_BASE}/classes/${id}`, {
      method: 'DELETE',
    });
    const data = await handleResponse<Class>(res);
    apiCache.invalidate('classes');
    return data;
  },

  async previewImport(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await httpClient(`${API_BASE}/classes/import/preview`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<any>(res);
  },

  async confirmImport(dto: any): Promise<any> {
    const res = await httpClient(`${API_BASE}/classes/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const data = await handleResponse<any>(res);
    apiCache.invalidate('classes');
    return data;
  }
};

