import { httpClient, handleResponse } from './http-client';
import { Department } from './department-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export const classApi = {
  async getClasses(): Promise<Class[]> {
    const res = await httpClient(`${API_BASE}/classes`);
    const data = await handleResponse<any[]>(res);
    return normalizeClasses(data);
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
      body: JSON.stringify(dto),
    });
    const data = await handleResponse<any>(res);
    return normalizeClass(data);
  },

  async updateClass(id: string, dto: any): Promise<Class> {
    const res = await httpClient(`${API_BASE}/classes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const data = await handleResponse<any>(res);
    return normalizeClass(data);
  },

  async deleteClass(id: string): Promise<Class> {
    const res = await httpClient(`${API_BASE}/classes/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Class>(res);
  }
};
