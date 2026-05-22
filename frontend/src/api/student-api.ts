import { Class } from './class-api';
import { tokenStorage } from './auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Student {
  _id: string;
  student_code: string;
  full_name: string;
  email?: string;
  date_bir: string; // ISO string / Date string
  sex: 'Male' | 'Female' | 'Other';
  status: 'Studying' | 'Reserved' | 'Dropped' | 'Graduated' | 'Suspended';
  class_id?: Class | string;
  training_point_id?: any;
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

export const studentApi = {
  async getStudents(): Promise<Student[]> {
    const res = await fetch(`${API_BASE}/students`);
    return handleResponse<Student[]>(res);
  },

  async getStudent(id: string): Promise<Student> {
    const res = await fetch(`${API_BASE}/students/${id}`);
    return handleResponse<Student>(res);
  },

  async createStudent(dto: Partial<Student>): Promise<Student> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<Student>(res);
  },

  async createStudentBulk(dtos: Partial<Student>[]): Promise<Student[]> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/students/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(dtos),
    });
    return handleResponse<Student[]>(res);
  },

  async updateStudent(id: string, dto: Partial<Student>): Promise<Student> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<Student>(res);
  },

  async deleteStudent(id: string): Promise<Student> {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    return handleResponse<Student>(res);
  }
};
