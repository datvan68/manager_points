import { httpClient, handleResponse } from './http-client';
import { Class } from './class-api';

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
  user_id?: { _id: string; user_name?: string; email?: string; status?: string } | string;
  account_status?: 'active' | 'inactive' | 'locked';
  createdAt?: string;
  updatedAt?: string;
}

export const studentApi = {
  async getStudents(): Promise<Student[]> {
    const res = await httpClient(`${API_BASE}/students`);
    return handleResponse<Student[]>(res);
  },

  async getStudent(id: string): Promise<Student> {
    const res = await httpClient(`${API_BASE}/students/${id}`);
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
  }
};
