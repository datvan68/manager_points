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

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const departmentApi = {
  // Departments
  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/departments`);
    return handleResponse<Department[]>(res);
  },

  async getDepartment(id: string): Promise<Department> {
    const res = await fetch(`${API_BASE}/departments/${id}`);
    return handleResponse<Department>(res);
  },

  async createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Department>(res);
  },

  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const res = await fetch(`${API_BASE}/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Department>(res);
  },

  async deleteDepartment(id: string): Promise<Department> {
    const res = await fetch(`${API_BASE}/departments/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Department>(res);
  }
};
