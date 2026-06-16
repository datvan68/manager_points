import { httpClient, handleResponse } from './http-client';
import { apiCache } from './api-cache';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  code?: string;
  description?: string;
}

export const departmentApi = {
  // Departments
  async getDepartments(): Promise<Department[]> {
    return apiCache.get('departments', async () => {
      const res = await httpClient(`${API_BASE}/departments`);
      return handleResponse<Department[]>(res);
    });
  },

  async getDepartment(id: string): Promise<Department> {
    const res = await httpClient(`${API_BASE}/departments/${id}`);
    return handleResponse<Department>(res);
  },

  async createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    const res = await httpClient(`${API_BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const data = await handleResponse<Department>(res);
    apiCache.invalidate('departments');
    return data;
  },

  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const res = await httpClient(`${API_BASE}/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const data = await handleResponse<Department>(res);
    apiCache.invalidate('departments');
    return data;
  },

  async deleteDepartment(id: string): Promise<Department> {
    const res = await httpClient(`${API_BASE}/departments/${id}`, {
      method: 'DELETE',
    });
    const data = await handleResponse<Department>(res);
    apiCache.invalidate('departments');
    return data;
  }
};
