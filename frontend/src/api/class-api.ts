import { Department } from './department-api';
import { tokenStorage } from './auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Class {
  _id: string;
  class_name: string;
  class_year: string;
  dept_id: Department | string;
  user_id?: any;
  class_type: 'Trung cấp' | 'Cao đẳng';
  headquarters?: 'Phân hiệu CSSĐ-NDT' | 'Phân hiệu CK';
  createdAt?: string;
  updatedAt?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const classApi = {
  async getClasses(): Promise<Class[]> {
    const res = await fetch(`${API_BASE}/classes`);
    return handleResponse<Class[]>(res);
  },

  async getClass(id: string): Promise<Class> {
    const res = await fetch(`${API_BASE}/classes/${id}`);
    return handleResponse<Class>(res);
  },

  async createClass(dto: any): Promise<Class> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<Class>(res);
  },

  async updateClass(id: string, dto: any): Promise<Class> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/classes/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<Class>(res);
  },

  async deleteClass(id: string): Promise<Class> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/classes/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    return handleResponse<Class>(res);
  }
};
